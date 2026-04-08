package com.mindx.serviceai.controller;

import com.mindx.serviceai.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"})
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> request) {
        try {
            String username = request.get("username");
            String password = request.get("password");
            String role = request.get("role");

            if (username == null || username.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Username is required");
            }
            if (password == null || password.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Password is required");
            }
            // Password rules:
            // - at least 8 chars
            // - at least one uppercase letter
            // - at least one symbol (non letter/digit)
            if (password.length() < 8
                    || !password.matches(".*[A-Z].*")
                    || !password.matches(".*[^A-Za-z0-9].*")) {
                return ResponseEntity.badRequest().body(
                        "Password must be at least 8 characters, include 1 uppercase letter, and include 1 symbol."
                );
            }
            if (role == null || role.trim().isEmpty()) {
                role = "CUSTOMER";
            }

            return ResponseEntity.ok(authService.register(username, password, role));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        try {
            String username = request.get("username");
            String password = request.get("password");

            if (username == null || username.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Username is required");
            }
            if (password == null || password.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Password is required");
            }

            return ResponseEntity.ok(authService.login(username, password));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}