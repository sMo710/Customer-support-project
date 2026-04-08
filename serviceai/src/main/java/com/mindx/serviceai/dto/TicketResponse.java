package com.mindx.serviceai.dto;

import com.mindx.serviceai.model.Message;
import com.mindx.serviceai.model.Ticket;
import lombok.Data;
import java.util.List;

@Data
public class TicketResponse {
    private Ticket ticket;
    private List<Message> messages;
}