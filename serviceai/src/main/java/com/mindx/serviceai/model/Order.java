package com.mindx.serviceai.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

@Entity
@Table(name = "orders")
@Data
public class Order {

    @Id
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    private String product;

    @Column(name = "estimated_delivery")
    private String estimatedDelivery;

    private String status;
}
