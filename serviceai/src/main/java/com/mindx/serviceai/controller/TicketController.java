package com.mindx.serviceai.controller;

import com.mindx.serviceai.dto.CreateTicketRequest;
import com.mindx.serviceai.dto.TicketResponse;
import com.mindx.serviceai.model.Ticket;
import com.mindx.serviceai.service.TicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/tickets")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"})
@RequiredArgsConstructor
public class TicketController {

    private final TicketService ticketService;

    // POST /tickets - Create a new ticket
    @PostMapping
    public ResponseEntity<?> createTicket(
            @RequestBody CreateTicketRequest request) {
        try {
            return ResponseEntity.ok(ticketService.createTicket(request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // GET /tickets - Get all tickets
    @GetMapping
    public ResponseEntity<List<Ticket>> getAllTickets() {
        return ResponseEntity.ok(ticketService.getAllTickets());
    }

    // GET /tickets/{id} - Get ticket + messages
    @GetMapping("/{id}")
    public ResponseEntity<TicketResponse> getTicketById(
            @PathVariable Long id) {
        return ResponseEntity.ok(ticketService.getTicketById(id));
    }

    // PATCH /tickets/{id}/status - Update ticket status
    @PatchMapping("/{id}/status")
    public ResponseEntity<Ticket> updateStatus(
            @PathVariable Long id,
            @RequestParam Ticket.TicketStatus status) {
        return ResponseEntity.ok(ticketService.updateTicketStatus(id, status));
    }

    // GET /tickets/search - Search tickets
    @GetMapping("/search")
    public ResponseEntity<List<Ticket>> searchTickets(
            @RequestParam String keyword) {
        return ResponseEntity.ok(ticketService.searchTickets(keyword));
    }

    // GET /tickets/stats - Get ticket stats
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getStats() {
        return ResponseEntity.ok(ticketService.getTicketStats());
    }

    @DeleteMapping("/cleanup")
    public ResponseEntity<Map<String, Long>> cleanupTickets(
            @RequestParam(defaultValue = "30") int olderThanDays,
            @RequestParam(defaultValue = "false") boolean confirmDelete) {
        long affected = ticketService.cleanupIrrelevantTickets(olderThanDays, confirmDelete);
        String key = confirmDelete ? "deletedTickets" : "matchedTickets";
        return ResponseEntity.ok(Map.of(key, affected));
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<?> addMessage(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {
        try {
            return ResponseEntity.ok(ticketService.addMessage(id, request.get("message")));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{id}/admin-messages")
    public ResponseEntity<?> addAdminMessage(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {
        try {
            return ResponseEntity.ok(ticketService.addAdminMessage(id, request.get("message")));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}