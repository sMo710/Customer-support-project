package com.mindx.serviceai;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ServiceaiApplication {

	public static void main(String[] args) {
		loadDotenvIntoSystemProperties();
		SpringApplication.run(ServiceaiApplication.class, args);
	}

	private static void loadDotenvIntoSystemProperties() {
		// Auto-load .env for both common run modes:
		// 1) running from serviceai/ folder  -> ./.env
		// 2) running from workspace root      -> ./serviceai/.env
		Dotenv rootDotenv = Dotenv.configure()
				.ignoreIfMalformed()
				.ignoreIfMissing()
				.load();
		Dotenv serviceaiDotenv = Dotenv.configure()
				.directory("./serviceai")
				.ignoreIfMalformed()
				.ignoreIfMissing()
				.load();

		copyIfAbsent(rootDotenv, serviceaiDotenv, "DB_USERNAME");
		copyIfAbsent(rootDotenv, serviceaiDotenv, "DB_PASSWORD");
		copyIfAbsent(rootDotenv, serviceaiDotenv, "GROQ_API_KEY");
		copyIfAbsent(rootDotenv, serviceaiDotenv, "JWT_SECRET");
	}

	private static void copyIfAbsent(Dotenv primary, Dotenv fallback, String key) {
		if (System.getProperty(key) == null && System.getenv(key) == null) {
			String value = primary.get(key);
			if (value == null || value.isBlank()) {
				value = fallback.get(key);
			}
			if (value != null && !value.isBlank()) {
				System.setProperty(key, value);
			}
		}
	}
}
