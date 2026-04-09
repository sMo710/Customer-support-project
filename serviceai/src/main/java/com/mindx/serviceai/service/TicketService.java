package com.mindx.serviceai.service;

import com.mindx.serviceai.dto.CreateTicketRequest;
import com.mindx.serviceai.dto.TicketResponse;
import com.mindx.serviceai.model.Message;
import com.mindx.serviceai.model.Order;
import com.mindx.serviceai.model.Ticket;
import com.mindx.serviceai.model.User;
import com.mindx.serviceai.repository.MessageRepository;
import com.mindx.serviceai.repository.OrderRepository;
import com.mindx.serviceai.repository.TicketRepository;
import com.mindx.serviceai.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class TicketService {
    private static final String SUPERVISOR_CONNECTING_MESSAGE =
            "I understand your concern. I have escalated this ticket to a human supervisor. A supervisor will be connected soon.";
    private static final Pattern ORDER_ID_PATTERN = Pattern.compile("(?i)(?:order(?:\\s+number)?\\s*#?\\s*)(\\d+)|#(\\d+)");
    // Matches formats like: "order (ID 101)", "order id: 101", "order - 101"
    private static final Pattern ORDER_ID_FALLBACK_PATTERN = Pattern.compile("(?i)order[^0-9]{0,30}(\\d+)");
    private static final Pattern ANY_NUMBER_PATTERN = Pattern.compile("\\d+");
    private static final List<String> TEST_QUERY_KEYWORDS = List.of(
            "test", "dummy", "sample", "qa", "hello world", "lorem"
    );

    private final TicketRepository ticketRepository;
    private final MessageRepository messageRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final AIService aiService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public TicketResponse createTicket(CreateTicketRequest request) {
        // Step 1: Validate
        if (request.getQuery() == null || request.getQuery().trim().isEmpty()) {
            throw new RuntimeException("Query cannot be empty");
        }

        // Step 3: Create and save ticket
        Ticket ticket = new Ticket();
        ticket.setUserId(resolveUserIdForTicketCreation(request.getUserId()));
        ticket.setQuery(request.getQuery());
        ticket.setStatus(Ticket.TicketStatus.OPEN);
        ticket.setCreatedAt(LocalDateTime.now());
        ticket = ticketRepository.save(ticket);
        ticket = applyToneStatusForMessage(ticket, request.getQuery());

        // Store the last explicitly provided order id (if present) for reliable follow-ups.
        Optional<Long> explicitOrderId = extractOrderIdFromUserText(request.getQuery());
        if (explicitOrderId.isPresent()) {
            ticket.setLastOrderId(explicitOrderId.get());
            ticketRepository.save(ticket);
        }

        // Step 4: Save user message
        Message userMessage = new Message();
        userMessage.setTicketId(ticket.getId());
        userMessage.setSender(Message.SenderType.USER);
        userMessage.setMessage(request.getQuery());
        userMessage.setTimestamp(LocalDateTime.now());
        messageRepository.save(userMessage);
        publishMessageToWebSocket(ticket, userMessage);

        // Step 5: Build AI response messages
        List<Message> conversationHistory = messageRepository.findByTicketIdOrderByTimestampAsc(ticket.getId());
        List<String> aiResponses = buildBotMessagesForUserMessage(ticket, request.getQuery(), conversationHistory);

        // Step 6: Save AI messages
        List<Message> savedAiMessages = saveAiMessages(ticket.getId(), aiResponses);

        // Step 7: Send WebSocket notification
        publishAiMessagesToWebSocket(ticket, savedAiMessages);

        // Step 8: Return full response
        TicketResponse response = new TicketResponse();
        response.setTicket(ticket);
        List<Message> responseMessages = new ArrayList<>();
        responseMessages.add(userMessage);
        responseMessages.addAll(savedAiMessages);
        response.setMessages(responseMessages);
        return response;
    }

    public List<Ticket> getAllTickets() {
        ensureCurrentUserIsAdmin();
        return ticketRepository.findAll();
    }

    public TicketResponse getTicketById(Long id) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + id));
        enforceTicketAccess(ticket);
        List<Message> messages = messageRepository
                .findByTicketIdOrderByTimestampAsc(id);

        TicketResponse response = new TicketResponse();
        response.setTicket(ticket);
        response.setMessages(messages);
        return response;
    }

    @Transactional
    public Ticket updateTicketStatus(Long id, Ticket.TicketStatus status) {
        ensureCurrentUserIsAdmin();
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + id));
        ticket.setStatus(status);
        ticket = ticketRepository.save(ticket);

        // Notify via WebSocket
        Map<String, Object> notification = new HashMap<>();
        notification.put("ticketId", ticket.getId());
        notification.put("status", ticket.getStatus().toString());
        messagingTemplate.convertAndSend("/topic/tickets", (Object) notification);

        return ticket;
    }

    public List<Ticket> searchTickets(String keyword) {
        ensureCurrentUserIsAdmin();
        return ticketRepository.findByQueryContainingIgnoreCase(keyword);
    }
    @Transactional
    public TicketResponse addMessage(Long ticketId, String messageText) {
        if (messageText == null || messageText.trim().isEmpty()) {
            throw new RuntimeException("Message cannot be empty");
        }
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new RuntimeException("Ticket not found"));
        enforceTicketAccess(ticket);

        ticket = applyToneStatusForMessage(ticket, messageText);

        // Update memory when user explicitly provides an order id.
        Optional<Long> explicitOrderId = extractOrderIdFromUserText(messageText);
        if (explicitOrderId.isPresent()) {
            ticket.setLastOrderId(explicitOrderId.get());
            ticketRepository.save(ticket);
        }

        // Save user message
        Message userMessage = new Message();
        userMessage.setTicketId(ticketId);
        userMessage.setSender(Message.SenderType.USER);
        userMessage.setMessage(messageText);
        userMessage.setTimestamp(LocalDateTime.now());
        messageRepository.save(userMessage);
        publishMessageToWebSocket(ticket, userMessage);

        // Prefer an explicit "order id/number" reference; otherwise fall back to last number in message.
        Optional<Long> maybeOrderId = extractOrderIdFromUserText(messageText)
                .or(() -> extractAnyNumericValue(messageText));
        String normalized = normalize(messageText);
        List<Message> conversationHistory = messageRepository.findByTicketIdOrderByTimestampAsc(ticketId);
        boolean cancelPending = isAwaitingCancellationOrderId(conversationHistory);
        boolean fastTrackPending = isAwaitingFastTrackOrderId(conversationHistory);

        // Refund / Return -> escalate to human
        if (containsAny(normalized, "refund", "return")) {
            ticket = ensureNeedsHuman(ticket);
            return buildMessageResponse(ticket, userMessage,
                    "I understand your request. I'm escalating this to a human agent.");
        }

        // Complaint / Angry user -> escalate with empathy
        if (containsAny(normalized, "angry", "bad", "worst", "complaint")) {
            ticket = ensureNeedsHuman(ticket);
            return buildMessageResponse(ticket, userMessage,
                    "I'm really sorry for your experience. I'm escalating this to a human agent.");
        }

        // Talk to human
        if (containsAny(normalized, "talk to human", "agent", "support")) {
            ticket = ensureNeedsHuman(ticket);
            return buildMessageResponse(ticket, userMessage,
                    "Connecting you to a human agent.");
        }

        // Cancel order flow (keyword OR pending cancellation)
        if (containsAny(normalized, "cancel order", "cancel") || cancelPending) {
            ticket = ensureNeedsHuman(ticket);
            Optional<Long> orderIdToCancel = maybeOrderId.isPresent()
                    ? maybeOrderId
                    : Optional.ofNullable(ticket.getLastOrderId());
            if (orderIdToCancel.isEmpty()) {
                return buildMessageResponse(ticket, userMessage,
                        "Please share your order ID to process cancellation. I've alerted a human agent to assist.");
            }
            Optional<Order> maybeOrder = orderRepository.findByUserIdAndId(ticket.getUserId(), orderIdToCancel.get());
            if (maybeOrder.isEmpty()) {
                return buildMessageResponse(ticket, userMessage,
                        "Sorry, I couldn't find any order with ID #" + orderIdToCancel.get() + ". Please check and try again. A human agent has been alerted.");
            }
            Order order = maybeOrder.get();
            order.setStatus("CANCELLED");
            orderRepository.save(order);
            return buildMessageResponse(ticket, userMessage,
                    "Your order (#" + order.getId() + ") has been cancelled. I've alerted a human agent.");
        }

        // Fast-track delivery flow (keyword OR pending fast-track)
        if (containsAny(normalized, "deliver faster", "fast", "urgent") || fastTrackPending) {
            ticket = ensureNeedsHuman(ticket);
            Optional<Long> orderIdToFastTrack = maybeOrderId.isPresent()
                    ? maybeOrderId
                    : Optional.ofNullable(ticket.getLastOrderId());
            if (orderIdToFastTrack.isEmpty()) {
                return buildMessageResponse(ticket, userMessage,
                        "Please share your order ID so I can check fast-track eligibility. I've alerted a human agent.");
            }
            Optional<Order> maybeOrder = orderRepository.findByUserIdAndId(ticket.getUserId(), orderIdToFastTrack.get());
            if (maybeOrder.isEmpty()) {
                return buildMessageResponse(ticket, userMessage,
                        "Sorry, I couldn't find any order with ID #" + orderIdToFastTrack.get() + ". Please check and try again. A human agent has been alerted.");
            }
            if (isYetToBeShipped(maybeOrder.get())) {
                return buildMessageResponse(ticket, userMessage,
                        "Your order has been upgraded to priority delivery. I've alerted a human agent.");
            }
            return buildMessageResponse(ticket, userMessage,
                    "Your order is already shipped. We will check the status and come back to you. A human agent has been alerted.");
        }

        // Build AI response messages
        List<String> aiResponses = buildBotMessagesForUserMessage(ticket, messageText, conversationHistory);

        // Save AI messages
        List<Message> savedAiMessages = saveAiMessages(ticketId, aiResponses);

        // Notify via WebSocket
        publishAiMessagesToWebSocket(ticket, savedAiMessages);

        TicketResponse response = new TicketResponse();
        response.setTicket(ticket);
        List<Message> responseMessages = new ArrayList<>();
        responseMessages.add(userMessage);
        responseMessages.addAll(savedAiMessages);
        response.setMessages(responseMessages);
        return response;
    }

    private Ticket ensureNeedsHuman(Ticket ticket) {
        if (ticket.getStatus() != Ticket.TicketStatus.NEEDS_HUMAN) {
            ticket.setStatus(Ticket.TicketStatus.NEEDS_HUMAN);
            return ticketRepository.save(ticket);
        }
        return ticket;
    }

    private boolean isYetToBeShipped(Order order) {
        return "YET_TO_BE_SHIPPED".equalsIgnoreCase(nullSafe(order.getStatus()));
    }

    private boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String text) {
        return text == null ? "" : text.toLowerCase();
    }

    private TicketResponse buildMessageResponse(Ticket ticket, Message userMessage, String botResponse) {
        List<Message> savedAiMessages = saveAiMessages(ticket.getId(), List.of(botResponse));
        publishAiMessagesToWebSocket(ticket, savedAiMessages);

        TicketResponse response = new TicketResponse();
        response.setTicket(ticket);
        List<Message> responseMessages = new ArrayList<>();
        responseMessages.add(userMessage);
        responseMessages.addAll(savedAiMessages);
        response.setMessages(responseMessages);
        return response;
    }

    @Transactional
    public TicketResponse addAdminMessage(Long ticketId, String messageText) {
        ensureCurrentUserIsAdmin();
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new RuntimeException("Ticket not found"));

        if (messageText == null || messageText.trim().isEmpty()) {
            throw new RuntimeException("Message cannot be empty");
        }

        Message adminMessage = new Message();
        adminMessage.setTicketId(ticketId);
        adminMessage.setSender(Message.SenderType.ADMIN);
        adminMessage.setMessage(messageText.trim());
        adminMessage.setTimestamp(LocalDateTime.now());
        adminMessage = messageRepository.save(adminMessage);

        publishMessageToWebSocket(ticket, adminMessage);

        TicketResponse response = new TicketResponse();
        response.setTicket(ticket);
        response.setMessages(List.of(adminMessage));
        return response;
    }

    private Optional<Long> extractAnyNumericValue(String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        Matcher matcher = ANY_NUMBER_PATTERN.matcher(text);
        Long last = null;
        while (matcher.find()) {
            try {
                last = Long.parseLong(matcher.group());
            } catch (NumberFormatException ignored) {
                // ignore
            }
        }
        return Optional.ofNullable(last);
    }
    public Map<String, Long> getTicketStats() {
        ensureCurrentUserIsAdmin();
        Map<String, Long> stats = new HashMap<>();
        stats.put("OPEN", 0L);
        stats.put("RESOLVED", 0L);
        stats.put("NEEDS_HUMAN", 0L);

        List<Object[]> results = ticketRepository.countByStatus();
        for (Object[] result : results) {
            String statusName = result[0].toString();
            Long count = (Long) result[1];
            stats.put(statusName, count);
        }

        return stats;
    }

    @Transactional
    public long cleanupIrrelevantTickets(int olderThanDays, boolean performDelete) {
        ensureCurrentUserIsAdmin();
        LocalDateTime cutoff = LocalDateTime.now().minusDays(Math.max(olderThanDays, 0));
        List<Ticket> allTickets = ticketRepository.findAll();

        List<Long> ticketIdsToDelete = allTickets.stream()
                .filter(ticket -> isOldTicket(ticket, cutoff) || isTestTicket(ticket))
                .map(Ticket::getId)
                .toList();

        if (ticketIdsToDelete.isEmpty()) {
            return 0L;
        }
        if (!performDelete) {
            return ticketIdsToDelete.size();
        }

        Set<Long> ticketIdSet = new HashSet<>(ticketIdsToDelete);
        List<Message> allMessages = messageRepository.findAll();
        List<Message> messagesToDelete = allMessages.stream()
                .filter(message -> ticketIdSet.contains(message.getTicketId()))
                .toList();

        messageRepository.deleteAll(messagesToDelete);
        ticketRepository.deleteAllById(ticketIdsToDelete);
        return ticketIdsToDelete.size();
    }

    private boolean isOrderQuery(String text) {
        if (text == null) {
            return false;
        }
        String normalized = text.toLowerCase();
        return normalized.contains("order")
                || normalized.contains("delivery")
                || normalized.contains("shipment")
                || normalized.contains("tracking")
                || normalized.contains("track");
    }

    private boolean shouldEscalateToHuman(String text) {
        if (text == null) {
            return false;
        }
        String normalized = text.toLowerCase();
        return normalized.contains("refund")
                || normalized.contains("complaint")
                || normalized.contains("angry")
                || normalized.contains("urgent")
                || normalized.contains("frustrated")
                || normalized.contains("cancel")
                || normalized.contains("broken")
                || normalized.contains("damaged")
                || normalized.contains("speak to admin")
                || normalized.contains("admin")
                || normalized.contains("supervisor")
                || normalized.contains("manager")
                || normalized.contains("human agent")
                || normalized.contains("real person");
    }

    private Ticket applyToneStatusForMessage(Ticket ticket, String messageText) {
        Ticket.TicketStatus newStatus = shouldEscalateToHuman(messageText)
                ? Ticket.TicketStatus.NEEDS_HUMAN
                : ticket.getStatus();
        if (ticket.getStatus() != newStatus) {
            ticket.setStatus(newStatus);
            return ticketRepository.save(ticket);
        }
        return ticket;
    }

    private List<String> buildBotMessagesForUserMessage(Ticket ticket, String messageText, List<Message> conversationHistory) {
        if (ticket.getStatus() == Ticket.TicketStatus.NEEDS_HUMAN
                && containsAny(normalize(messageText), "talk to human", "agent", "support", "supervisor")) {
            return List.of(SUPERVISOR_CONNECTING_MESSAGE);
        }

        Optional<String> orderContext = tryBuildOrderContext(ticket, messageText, conversationHistory);
        if (orderContext.isPresent()) {
            return List.of(aiService.generateResponseFromHistory(conversationHistory, orderContext.get()));
        }

        return List.of(aiService.generateResponseFromHistory(conversationHistory, null));
    }

    private Optional<String> tryBuildOrderContext(Ticket ticket, String messageText, List<Message> conversationHistory) {
        boolean orderRelated = isOrderQuery(messageText) || isAwaitingOrderId(conversationHistory);
        if (!orderRelated || ticket.getUserId() == null) {
            return Optional.empty();
        }

        Long orderId = extractOrderId(messageText);
        if (orderId == null && isPlainNumericMessage(messageText)) {
            orderId = extractPlainNumericOrderId(messageText);
        }
        if (orderId == null) {
            // Remember last order id explicitly provided by the user and reuse it,
            // unless the user provides a new id in the current message.
            orderId = getLastUserProvidedOrderId(conversationHistory).orElse(null);
        }

        if (orderId != null) {
            Optional<Order> scoped = orderRepository.findByUserIdAndId(ticket.getUserId(), orderId);
            if (scoped.isPresent()) {
                ticket.setLastOrderId(orderId);
                ticketRepository.save(ticket);
                return scoped.map(this::buildOrderAiContext);
            }

            // Order exists but is not associated with this user.
            Optional<Order> any = orderRepository.findById(orderId);
            if (any.isPresent()) {
                return Optional.of(
                        "Order lookup result:\n"
                                + "Order ID: " + orderId + "\n"
                                + "Found in database: YES\n"
                                + "Belongs to current user: NO\n"
                                + "Instruction: Apologize and ask the user to log into the correct account. "
                                + "Do NOT disclose any order details."
                );
            }
            return Optional.empty();
        }

        List<Order> userOrders = orderRepository.findByUserIdOrderByIdDesc(ticket.getUserId());
        if (userOrders.isEmpty()) {
            return Optional.empty();
        }

        if (userOrders.size() > 1) {
            return Optional.of(buildOrderIdRequestContext(userOrders));
        }

        // Auto-use latest order only when there is no explicit id in the current message.
        Order selected = userOrders.get(0);
        ticket.setLastOrderId(selected.getId());
        ticketRepository.save(ticket);
        return Optional.of(buildOrderAiContext(selected));
    }

    private List<Message> saveAiMessages(Long ticketId, List<String> aiResponses) {
        List<Message> savedMessages = new ArrayList<>();
        for (String aiResponse : aiResponses) {
            Message aiMessage = new Message();
            aiMessage.setTicketId(ticketId);
            aiMessage.setSender(Message.SenderType.AI);
            aiMessage.setMessage(aiResponse);
            aiMessage.setTimestamp(LocalDateTime.now());
            savedMessages.add(messageRepository.save(aiMessage));
        }
        return savedMessages;
    }

    private void publishAiMessagesToWebSocket(Ticket ticket, List<Message> aiMessages) {
        for (Message aiMessage : aiMessages) {
            publishMessageToWebSocket(ticket, aiMessage);
        }
    }

    private void publishMessageToWebSocket(Ticket ticket, Message message) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("ticketId", ticket.getId());
        payload.put("status", ticket.getStatus().toString());
        payload.put("id", message.getId());
        payload.put("sender", message.getSender().toString());
        payload.put("message", message.getMessage());
        payload.put("timestamp", message.getTimestamp());

        messagingTemplate.convertAndSend("/topic/tickets", (Object) payload);
        messagingTemplate.convertAndSend("/topic/tickets/" + ticket.getId(), (Object) payload);
    }

    private boolean isAwaitingOrderId(List<Message> conversationHistory) {
        if (conversationHistory == null || conversationHistory.isEmpty()) {
            return false;
        }
        Message lastMessage = conversationHistory.get(conversationHistory.size() - 1);
        return lastMessage.getSender() == Message.SenderType.AI
                && lastMessage.getMessage() != null
                && lastMessage.getMessage().toLowerCase().contains("order id");
    }

    private Optional<String> getLastAiMessageText(List<Message> conversationHistory) {
        if (conversationHistory == null || conversationHistory.isEmpty()) {
            return Optional.empty();
        }
        for (int i = conversationHistory.size() - 1; i >= 0; i--) {
            Message msg = conversationHistory.get(i);
            if (msg != null && msg.getSender() == Message.SenderType.AI && msg.getMessage() != null) {
                return Optional.of(msg.getMessage());
            }
        }
        return Optional.empty();
    }

    private boolean isAwaitingCancellationOrderId(List<Message> conversationHistory) {
        return getLastAiMessageText(conversationHistory)
                .map((text) -> {
                    // Must be the bot asking for cancellation order ID
                    String n = normalize(text);
                    return n.contains("process cancellation")
                            && n.contains("order id");
                })
                .orElse(false);
    }

    private boolean isAwaitingFastTrackOrderId(List<Message> conversationHistory) {
        return getLastAiMessageText(conversationHistory)
                .map((text) -> {
                    String n = normalize(text);
                    return n.contains("fast-track eligibility")
                            && n.contains("order id");
                })
                .orElse(false);
    }

    private Optional<Long> getLastUserProvidedOrderId(List<Message> conversationHistory) {
        if (conversationHistory == null || conversationHistory.isEmpty()) {
            return Optional.empty();
        }

        for (int i = conversationHistory.size() - 1; i >= 0; i--) {
            Message msg = conversationHistory.get(i);
            if (msg == null || msg.getSender() != Message.SenderType.USER) continue;
            if (msg.getMessage() == null) continue;

            Optional<Long> extracted = extractOrderIdFromUserText(msg.getMessage().trim());
            if (extracted.isPresent()) {
                return extracted;
            }
        }
        return Optional.empty();
    }

    private Optional<Long> extractOrderIdFromUserText(String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }

        if (isPlainNumericMessage(text)) {
            try {
                return Optional.of(Long.parseLong(text.trim()));
            } catch (NumberFormatException ignored) {
                return Optional.empty();
            }
        }

        Long extracted = extractOrderId(text);
        if (extracted != null) {
            return Optional.of(extracted);
        }

        Matcher fallback = ORDER_ID_FALLBACK_PATTERN.matcher(text);
        if (fallback.find()) {
            try {
                return Optional.of(Long.parseLong(fallback.group(1)));
            } catch (NumberFormatException ignored) {
                return Optional.empty();
            }
        }

        // Last resort: if the message explicitly mentions "order", take the last number.
        String lower = text.toLowerCase();
        if (lower.contains("order")) {
            Matcher nums = ANY_NUMBER_PATTERN.matcher(text);
            Long lastFound = null;
            while (nums.find()) {
                try {
                    lastFound = Long.parseLong(nums.group());
                } catch (NumberFormatException ignored) {
                    // ignore
                }
            }
            return Optional.ofNullable(lastFound);
        }

        return Optional.empty();
    }

    private Long extractOrderId(String text) {
        if (text == null) {
            return null;
        }
        Matcher matcher = ORDER_ID_PATTERN.matcher(text);
        if (!matcher.find()) {
            return null;
        }
        String first = matcher.group(1);
        String second = matcher.group(2);
        String value = first != null ? first : second;
        return value != null ? Long.parseLong(value) : null;
    }

    private Long extractPlainNumericOrderId(String text) {
        if (text == null) {
            return null;
        }
        String trimmed = text.trim();
        if (!trimmed.matches("\\d+")) {
            return null;
        }
        return Long.parseLong(trimmed);
    }

    private boolean isPlainNumericMessage(String text) {
        return text != null && text.trim().matches("\\d+");
    }

    private String buildOrderAiContext(Order order) {
        return "Verified order data from database (source of truth):\n"
                + "Order ID: " + order.getId() + "\n"
                + "Product: " + nullSafe(order.getProduct()) + "\n"
                + "Status: " + formatOrderStatus(order.getStatus()) + "\n"
                + "Estimated delivery: " + nullSafe(order.getEstimatedDelivery()) + "\n"
                + "Use only this order data for order-related reply. Do not invent extra fields.";
    }

    private String buildOrderIdRequestContext(List<Order> orders) {
        StringBuilder ids = new StringBuilder();
        int limit = Math.min(orders.size(), 5);
        for (int i = 0; i < limit; i++) {
            if (i > 0) ids.append(", ");
            ids.append(orders.get(i).getId());
        }
        return "Order lookup needs explicit ID. Ask the user to provide one order ID. "
                + "Recent order IDs for this user: " + ids + ".";
    }

    private String nullSafe(String value) {
        return value == null || value.isBlank() ? "Not available" : value;
    }

    private String formatOrderStatus(String rawStatus) {
        String status = nullSafe(rawStatus);
        if ("Not available".equals(status)) {
            return status;
        }
        return switch (status) {
            case "SHIPPED" -> "Shipped";
            case "OUT_FOR_DELIVERY" -> "Out for delivery";
            case "YET_TO_BE_SHIPPED" -> "Yet to be shipped";
            case "DELIVERED" -> "Delivered";
            case "DELIVERED_SUCCESSFULLY" -> "Delivered";
            case "CANCELLED" -> "Cancelled";
            default -> status;
        };
    }

    private boolean isOldTicket(Ticket ticket, LocalDateTime cutoff) {
        return ticket.getCreatedAt() != null && ticket.getCreatedAt().isBefore(cutoff);
    }

    private boolean isTestTicket(Ticket ticket) {
        if (ticket.getQuery() == null) {
            return false;
        }
        String normalizedQuery = ticket.getQuery().toLowerCase();
        return TEST_QUERY_KEYWORDS.stream().anyMatch(normalizedQuery::contains);
    }

    private Long resolveUserIdForTicketCreation(Long requestedUserId) {
        Optional<User> currentUser = getCurrentUser();
        if (currentUser.isEmpty()) {
            return requestedUserId != null ? requestedUserId : 1L;
        }
        if (currentUser.get().getRole() == User.Role.ADMIN && requestedUserId != null) {
            return requestedUserId;
        }
        return currentUser.get().getId();
    }

    private void enforceTicketAccess(Ticket ticket) {
        Optional<User> currentUser = getCurrentUser();
        if (currentUser.isEmpty()) {
            return;
        }
        User user = currentUser.get();
        if (user.getRole() == User.Role.ADMIN) {
            return;
        }
        if (!user.getId().equals(ticket.getUserId())) {
            throw new RuntimeException("You are not allowed to access this ticket");
        }
    }

    private void ensureCurrentUserIsAdmin() {
        Optional<User> currentUser = getCurrentUser();
        if (currentUser.isPresent() && currentUser.get().getRole() != User.Role.ADMIN) {
            throw new RuntimeException("Admin access required");
        }
    }

    private Optional<User> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return Optional.empty();
        }
        return userRepository.findByUsername(authentication.getName());
    }
}