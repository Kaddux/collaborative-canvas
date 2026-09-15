package com.collaborative_canvas.config;

import com.collaborative_canvas.service.CanvasOperationProducer;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class KafkaConfig {

    /**
     * Dedicated, bounded side-channel for publishing to the audit log. KafkaTemplate.send()
     * can block on metadata when the broker is unreachable, so the publish is offloaded here
     * and the WebSocket handler never blocks on Kafka.
     */
    @Bean(name = "canvasOperationPublisherExecutor", destroyMethod = "shutdown")
    public ExecutorService canvasOperationPublisherExecutor() {
        return Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, "canvas-operation-publisher");
            thread.setDaemon(true);
            return thread;
        });
    }

    /**
     * Declares the operation-log topic explicitly so the partition count is deterministic
     * instead of relying on broker auto-creation. The topic key is the {@code canvasId};
     * six partitions give local-dev headroom while still guaranteeing that a given canvas
     * always maps to a single partition.
     */
    @Bean
    public NewTopic canvasOperationsTopic() {
        return TopicBuilder.name(CanvasOperationProducer.TOPIC)
                .partitions(6)
                .replicas(1)
                .build();
    }
}
