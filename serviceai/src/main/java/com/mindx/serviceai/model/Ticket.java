package com.mindx.serviceai.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "tickets")
@Data
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    @Column(columnDefinition = "TEXT")
    private String query;

    @Enumerated(EnumType.STRING)
    private TicketStatus status;

    private LocalDateTime createdAt;

    // Remembers the last order id explicitly provided by the user in this ticket.
    // This drives order-specific actions (fast-track/cancel/tracking) reliably.
    private Long lastOrderId;

    public enum TicketStatus {
        OPEN, RESOLVED, NEEDS_HUMAN
    }
}