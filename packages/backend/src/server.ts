import app from "./app";
import mongoose from "mongoose";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down gracefully...");

  // Close DB connection
  await mongoose.disconnect();

  // Close HTTP server
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });

  // If server hasn't closed after 10 seconds, force shutdown
  setTimeout(() => {
    console.error("Force shutdown due to timeout.");
    process.exit(1);
  }, 10000);
};

// Catch termination signals and call the shutdown function
process.on("SIGINT", shutdown); // Ctrl+C
process.on("SIGTERM", shutdown); // System signals
