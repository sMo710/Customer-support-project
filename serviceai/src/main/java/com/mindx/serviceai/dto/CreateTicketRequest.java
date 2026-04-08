package com.mindx.serviceai.dto;

import lombok.Data;

@Data
public class CreateTicketRequest {
    private String query;
    private Long userId;
}