package com.mindx.serviceai.repository;

import com.mindx.serviceai.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findByTicketIdOrderByTimestampAsc(Long ticketId);
}