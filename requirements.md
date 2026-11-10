# SMART Aqua Pond Requirements

## 1. Project Overview

SMART Aqua Pond is a web-based aquaculture pond monitoring prototype for fish-pond production. The system provides a single dashboard for reviewing pond conditions, fish health indicators, alerts, and operational controls.

The initial target species is Nile Tilapia, but the data model must allow other fish varieties to be configured for future ponds.

This document defines the requirements for the current prototype and the interfaces needed for future hardware and computer-vision integrations.

## 2. Scope

### 2.1 In scope

- Monitoring essential pond water parameters:
  - Water temperature
  - pH
  - Dissolved oxygen
  - Water turbidity
- Pond and fish-species information
- Recent sensor-reading history
- Fish habitat and behavior monitoring through a camera integration point
- Fish health and stress alerts
- Manual operator review and response guidance
- Manual aerator and water-pump controls
- Manual fish feeding records
- Dashboard, REST API, and MySQL persistence
- Clearly labeled prototype/demo behavior when real devices or models are unavailable

### 2.2 Out of scope

- An ammonia sensor, ammonia monitoring, ammonia alerts, or ammonia-related automation
- Automatic diagnosis of fish disease
- Unsupervised veterinary or water-treatment decisions
- Direct control of physical equipment without a validated device gateway and safety interlocks
- Production-grade multi-user identity management in the current prototype

## 3. Users and Operating Context

### 3.1 Primary user

The primary user is a pond manager or aquaculture operator who needs to review pond conditions and take timely operational action.

### 3.2 Operating assumptions

- The prototype is accessed through a modern web browser.
- The frontend runs on Next.js and communicates with the backend over HTTP.
- The backend uses Node.js, Express, and MySQL.
- Sensor values may be simulated until calibrated sensors are connected.
- Camera status and fish-stress classifications may be simulated until a camera and validated computer-vision model are connected.

## 4. Functional Requirements

### FR-01: Pond profile

The system shall store and display:

- Pond name
- Fish species or variety
- Pond volume in liters
- Overall pond status: healthy, attention, or critical

The system should support multiple ponds in the data model, even though the current dashboard presents the first configured pond.

### FR-02: Water-quality monitoring

The system shall store timestamped readings for:

- Temperature in degrees Celsius
- pH
- Dissolved oxygen in milligrams per liter
- Turbidity in NTU

The dashboard shall show the latest available value for each parameter and indicate when the value was recorded.

The backend shall provide recent reading history for a selected pond, with the current prototype returning the latest 24 readings.

### FR-03: Water-condition status

The system shall present a readable pond condition status and use alerts or status indicators when readings require operator attention.

Thresholds must be configurable as domain rules rather than embedded in presentation-only code. The prototype may use seeded/demo status values until threshold configuration is implemented.

### FR-04: Fish and habitat monitoring

The dashboard shall provide a fish-health and habitat section that:

- Shows camera integration status
- Provides a location for camera observations or a live feed
- Displays fish behavior observations and health-related alerts
- Clearly indicates when camera analysis is unavailable or simulated

The system should support observations such as unusual surface activity, abnormal behavior, visible body-color changes, or other deviations from normal daily behavior. These observations are indicators for human review, not an automatic diagnosis.

### FR-05: Fish-stress alerts

The system shall support unresolved alerts with:

- Severity: information, warning, or critical
- Category
- Human-readable message
- Creation timestamp
- Pond association
- Resolved/unresolved state in the persistence model

The dashboard shall display recent unresolved alerts and distinguish warning and critical conditions visually.

### FR-06: Immediate-response guidance

When a water or fish-health condition requires attention, the interface shall provide an appropriate operator response, such as:

### FR-07: Aerator and pump controls

The system shall allow an operator to request the enabled or disabled state of:

- Pond aerator
- Water-circulation pump

The API shall validate the device name and boolean state before updating the prototype database state.

The interface shall show whether each device is running or in standby and shall indicate that the current prototype does not directly operate physical equipment.

### FR-08: Fish feeder

The system shall allow an operator to record a manual feeding event with an amount in grams.

The system shall validate feeding amounts between 1 and 1,000 grams and persist:

- Pond
- Amount
- Feeding mode
- Creation timestamp

Scheduled feeding and physical feeder actuation are future integration capabilities and are not required for the current prototype.

### FR-09: Dashboard fallback behavior

If the backend or database is unavailable, the frontend shall display clearly labeled demo data rather than presenting it as live sensor data.

The interface shall provide a visible connection or data-source indication so the operator can distinguish connected data from fallback data.

## 5. Backend and API Requirements

The backend shall expose the following REST endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Report API and database health |
| GET | `/api/dashboard` | Return the primary pond, latest reading, devices, and unresolved alerts |
| GET | `/api/ponds` | Return configured ponds |
| GET | `/api/ponds/:id/readings` | Return recent readings for a pond |
| GET | `/api/alerts` | Return unresolved alerts |
| POST | `/api/controls` | Update a prototype aerator or pump state |
| POST | `/api/feeder` | Record a manual feeding event |

The backend shall:

- Use parameterized database queries.
- Return meaningful HTTP status codes for validation, missing records, service failures, and success.
- Avoid exposing database credentials or internal stack traces to clients.
- Validate request bodies before changing state or writing records.
- Allow the frontend origin to be configured through environment variables.

## 6. Data Requirements

The MySQL database shall persist at least the following entities:

- `ponds`: pond identity, species, volume, status, and creation time
- `sensor_readings`: pond, supported water parameters, and recording time
- `alerts`: pond, severity, category, message, resolution state, and creation time
- `devices`: pond, supported device key, label, enabled state, and update time
- `feeding_events`: pond, amount, feeding mode, and creation time

All sensor readings and operational events shall be associated with a pond and timestamped.

## 7. Frontend Requirements

The frontend shall:

- Use the existing Next.js App Router and TypeScript setup.
- Present a responsive dashboard suitable for desktop and mobile layouts.
- Display water metrics, pond identity, fish-health information, device controls, feeder input, and recent alerts.
- Provide loading, error, unavailable-camera, and fallback-data states.
- Prevent duplicate actions while a control or feeder request is in progress.
- Use accessible labels for buttons, inputs, status indicators, and controls.
- Avoid presenting simulated values or classifications as verified real-world measurements.


- Review the latest water readings
- Inspect the camera feed or habitat observation
- Check aerator and pump state
- Consider a partial water change when water conditions are unstable or unsafe, subject to operator judgment and approved aquaculture procedures
- Recheck the pond after corrective action

The prototype shall not automatically perform a water change or prescribe veterinary treatment.


## 8. Safety, Security, and Reliability

Before physical deployment, the system shall add:

- Authentication and authorization
- TLS for network communication
- Input validation and rate limiting
- Audit logs for control actions
- Device authentication
- Hardware fail-safe behavior and emergency shutoff
- Sensor calibration and validation procedures
- Camera privacy and retention policies
- Human approval for treatment, water-change, and animal-health decisions

The prototype shall communicate that database state changes are not equivalent to physical actuator state changes.

## 9. Non-Functional Requirements

### NFR-01: Maintainability

The implementation shall retain a clear separation between frontend presentation, backend request handling, and database access.

### NFR-02: Performance

Dashboard requests should return promptly under normal local development conditions and should avoid unnecessary repeated database queries.

### NFR-03: Availability

The frontend shall remain usable for viewing demo data when the backend is unavailable, while clearly showing that live data is unavailable.

### NFR-04: Data integrity

Foreign keys shall associate readings, alerts, devices, and feeding events with existing ponds. Invalid device states and invalid feeding amounts shall be rejected.

### NFR-05: Observability

The backend shall expose a health endpoint and log server-side errors sufficiently for local troubleshooting without leaking secrets to the client.

## 10. Technology and Environment Requirements

- Node.js 20 or newer
- npm
- MySQL 8 or newer
- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS, and lucide-react
- Backend: Node.js, Express, mysql2, cors, and dotenv
- Database setup through `backend/database/schema.sql`

## 11. Acceptance Criteria

The prototype is acceptable when:

1. The dashboard loads a pond profile and latest supported water readings.
2. Temperature, pH, dissolved oxygen, and turbidity are visible with units.
3. Recent unresolved fish-health or habitat alerts are visible with severity.
4. Camera availability is clearly represented, including an unavailable or simulated state.
5. Aerator and pump controls validate requests and update prototype database state.
6. A valid manual feeding amount can be recorded, while invalid amounts are rejected.
7. The frontend displays clearly labeled fallback data when the API is unavailable.
8. The API health endpoint distinguishes connected and disconnected database states.
9. No ammonia sensor feature, field, metric, alert, control, or acceptance criterion is required by this specification.
10. The interface warns operators that demo values and database control states are not proof of calibrated sensor readings or physical equipment operation.

## 12. Prototype Limitations

This project is an initial software prototype. Real sensor ingestion, camera streaming, computer-vision classification, and physical actuator control require additional hardware, integration services, calibration, testing, authentication, and safety review. The system must not be used as the sole basis for animal-health, water-treatment, or emergency decisions.
