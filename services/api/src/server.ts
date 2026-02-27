import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, env.host, () => {
  // Keep startup log explicit for local and container logs.
  console.log(`TripMate API listening on http://${env.host}:${env.port}`);
});
