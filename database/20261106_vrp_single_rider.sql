-- Single-rider route planning. Apply once after a database backup.
ALTER TABLE deliveries
    ADD COLUMN latitude DECIMAL(10,7) NULL AFTER customer_address,
    ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude,
    ADD COLUMN location_confirmed TINYINT(1) NOT NULL DEFAULT 0 AFTER longitude;

CREATE TABLE branch_locations (
    branch_id TINYINT NOT NULL,
    location_name VARCHAR(120) NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    PRIMARY KEY (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO branch_locations (branch_id, location_name, latitude, longitude)
VALUES (1, 'E.V.A. Gas Trading Malilipot Branch', 13.3199218, 123.7398304);

CREATE TABLE delivery_routes (
    id INT NOT NULL AUTO_INCREMENT,
    branch_id TINYINT NOT NULL,
    rider_id INT NOT NULL,
    created_by INT NOT NULL,
    total_distance_m INT NOT NULL DEFAULT 0,
    total_duration_s INT NOT NULL DEFAULT 0,
    geometry_json LONGTEXT NULL,
    route_status ENUM('Planned','Archived') NOT NULL DEFAULT 'Planned',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_route_rider_status (rider_id, route_status),
    FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE delivery_route_stops (
    route_id INT NOT NULL,
    delivery_id INT NOT NULL,
    stop_sequence INT NOT NULL,
    PRIMARY KEY (route_id, delivery_id),
    UNIQUE KEY uq_route_stop_sequence (route_id, stop_sequence),
    FOREIGN KEY (route_id) REFERENCES delivery_routes(id) ON DELETE CASCADE,
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
