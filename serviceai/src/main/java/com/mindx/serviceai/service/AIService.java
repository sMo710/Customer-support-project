package com.mindx.serviceai.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import com.mindx.serviceai.model.Message;
import java.util.Map;
import java.util.List;
import java.util.HashMap;
import java.util.ArrayList;
import io.netty.channel.ChannelOption;
import lombok.extern.slf4j.Slf4j;
import reactor.netty.http.client.HttpClient;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.core.ParameterizedTypeReference;
import java.time.Duration;

@Service
@Slf4j
public class AIService {

    @Value("${groq.api.key}")
    private String apiKey;

    @Value("${groq.api.url}")
    private String apiUrl;

    private final WebClient webClient;

    public AIService() {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 10000)
                .responseTimeout(Duration.ofSeconds(30));

        this.webClient = WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .codecs(configurer -> configurer
                        .defaultCodecs()
                        .maxInMemorySize(1024 * 1024))
                .build();
    }

    public String generateResponse(String userQuery) {
        List<Message> history = new ArrayList<>();
        Message message = new Message();
        message.setSender(Message.SenderType.USER);
        message.setMessage(userQuery);
        history.add(message);
        return generateResponseFromHistory(history, null);
    }

    public String generateResponseFromHistory(List<Message> history) {
        return generateResponseFromHistory(history, null);
    }

    public String generateResponseFromHistory(List<Message> history, String extraContext) {
        int maxRetries = 3;
        int attempt = 0;

        while (attempt < maxRetries) {
            try {
                Map<String, Object> systemMessage = new HashMap<>();
                systemMessage.put("role", "system");
                systemMessage.put("content", "You are a customer support assistant for Bonsai.\n"
                        + "Rules:\n"
                        + "1) Read the latest user message carefully and answer that exact request.\n"
                        + "2) Use conversation history for context, but do not ignore the latest message.\n"
                        + "3) If system-provided order context is present, treat it as source of truth.\n"
                        + "4) Never invent facts, fields, numbers, or shipping details not provided.\n"
                        + "5) If information is missing, explicitly say you do not have that information and ask a short clarifying question.\n"
                        + "6) Keep replies concise, clear, and directly actionable.\n"
                        + "7) If user asks for refund/complaint with frustration, respond empathetically and mention escalation.\n"
                        + "8) Never include links or URLs in your response.\n"
                        + "9) You cannot query databases. Use only order details provided in system context by backend.");

                List<Map<String, Object>> messages = new ArrayList<>();
                messages.add(systemMessage);
                if (extraContext != null && !extraContext.isBlank()) {
                    Map<String, Object> contextMessage = new HashMap<>();
                    contextMessage.put("role", "system");
                    contextMessage.put("content", extraContext);
                    messages.add(contextMessage);
                }
                for (Message historyMessage : history) {
                    Map<String, Object> chatMessage = new HashMap<>();
                    if (historyMessage.getSender() == Message.SenderType.AI) {
                        chatMessage.put("role", "assistant");
                    } else {
                        chatMessage.put("role", "user");
                    }
                    chatMessage.put("content", historyMessage.getMessage());
                    messages.add(chatMessage);
                }

                Map<String, Object> requestBody = new HashMap<>();
                requestBody.put("model", "openai/gpt-oss-20b");
                requestBody.put("messages", messages);
                requestBody.put("max_tokens", 200);
                requestBody.put("temperature", 0.2d);
                requestBody.put("top_p", 0.8d);

                Map<String, Object> response = webClient.post()
                        .uri(apiUrl)
                        .header("Authorization", "Bearer " + apiKey)
                        .header("Content-Type", "application/json")
                        .bodyValue(requestBody)
                        .retrieve()
                        .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                        .block();

                log.debug("AI response received. hasChoices={}", response != null && response.get("choices") != null);

                if (response == null || response.get("choices") == null) {
                    throw new RuntimeException("Invalid AI response payload");
                }

                List<?> choices = (List<?>) response.get("choices");
                if (choices.isEmpty()) {
                    throw new RuntimeException("AI response has no choices");
                }

                Map<?, ?> firstChoice = (Map<?, ?>) choices.get(0);
                Map<?, ?> message = (Map<?, ?>) firstChoice.get("message");
                Object contentObj = message != null ? message.get("content") : null;
                String content = contentObj != null ? contentObj.toString().trim() : "";
                if (!content.isBlank()) {
                    if (looksHallucinated(content)) {
                        return "I do not have enough verified information to answer that accurately. "
                                + "Please share the order ID or clarify your request.";
                    }
                    if (containsUngroundedLogisticsDetails(content, extraContext)) {
                        return "I do not have verified tracking details yet. "
                                + "Please share your order ID so I can check the exact status from our records.";
                    }
                    if (containsLink(content)) {
                        return "I cannot provide links here. Please share your order ID and I will provide status details directly.";
                    }
                    return content;
                }
                throw new RuntimeException("AI returned empty content");

            } catch (Exception e) {
                attempt++;
                log.warn("AI API call failed on attempt {}/{}", attempt, maxRetries, e);
                if (attempt < maxRetries) {
                    try {
                        log.info("Retrying AI API call in 2 seconds");
                        Thread.sleep(2000);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        log.warn("AI retry sleep interrupted");
                    }
                }
            }
        }

        return "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
    }

    private boolean looksHallucinated(String content) {
        String normalized = content.toLowerCase();
        return normalized.contains("[") || normalized.contains("]")
                || normalized.contains("lorem ipsum")
                || normalized.contains("{{")
                || normalized.contains("}}");
    }

    private boolean containsUngroundedLogisticsDetails(String content, String extraContext) {
        String normalized = content.toLowerCase();
        String context = extraContext == null ? "" : extraContext.toLowerCase();

        // If context already contains verified logistics fields, allow them.
        boolean contextHasTrackingData = context.contains("tracking")
                || context.contains("carrier")
                || context.contains("shipment")
                || context.contains("shipped");
        if (contextHasTrackingData) {
            return false;
        }

        // Block fabricated shipment/tracking specifics when not grounded by context.
        return normalized.contains("tracking number")
                || normalized.contains("carrier:")
                || normalized.contains("ups")
                || normalized.contains("fedex")
                || normalized.contains("dhl")
                || normalized.matches("(?s).*\\b1z[0-9a-z]{10,}\\b.*");
    }

    private boolean containsLink(String content) {
        String normalized = content.toLowerCase();
        return normalized.contains("http://")
                || normalized.contains("https://")
                || normalized.contains("www.");
    }
}