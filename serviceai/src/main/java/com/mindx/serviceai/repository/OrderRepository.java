package com.mindx.serviceai.repository;

import com.mindx.serviceai.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserIdOrderByIdDesc(Long userId);
    Optional<Order> findByUserIdAndId(Long userId, Long id);
}
