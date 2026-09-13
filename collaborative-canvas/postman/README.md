# Postman API tests

1. Start PostgreSQL with `docker compose up -d` from the project root.
2. Start the application with `./mvnw spring-boot:run` or `mvnw.cmd spring-boot:run` on Windows.
3. Import `Collaborative Canvas.postman_collection.json` and `Collaborative Canvas.postman_environment.json` into Postman.
4. Select the `Collaborative Canvas - Local` environment.
5. Run `Create canvas` before the other requests. Its test script stores the returned ID as `canvasId`.
6. Open `Connect to canvas` as a WebSocket request.

## WebSocket messages

Send these JSON messages after connecting. Replace `object-1` if needed.

### Create object

```json
{
  "type": "CREATE_OBJECT",
  "objectId": "object-1",
  "objectType": "RECTANGLE",
  "x": 100,
  "y": 150,
  "width": 200,
  "height": 100,
  "rotation": 0,
  "color": "#ffffff",
  "strokeColor": "#000000",
  "strokeWidth": 2,
  "text": null
}
```

### Move object

```json
{
  "type": "MOVE_OBJECT",
  "objectId": "object-1",
  "x": 240,
  "y": 180
}
```

### Delete object

```json
{
  "type": "DELETE_OBJECT",
  "objectId": "object-1"
}
```

On connect, the server sends `SYNC_STATE`. Successful changes are broadcast as `OPERATION`; invalid messages return `ERROR`.
