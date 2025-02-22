import dotenv from "dotenv";
dotenv.config();

const config = {
  redis: {
    url: "redis://host.docker.internal:6380",
  },
};

export default config;
