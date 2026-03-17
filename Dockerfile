# Stage 1: Install dependencies and build the app
FROM node:20-alpine AS builder

# Set working directory inside the container
WORKDIR /app

# Copy dependency files first to leverage Docker cache
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the code and build for production
COPY . .
RUN npm run build

# Stage 2: Production environment (The "Lean" image)
FROM node:20-alpine AS runner

# Set working directory inside the container
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy only the necessary files from the builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Expose the port your Next.js app uses
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Start the application
CMD ["sh","-c","PORT=${PORT} HOSTNAME=${HOSTNAME} npm run start -- -p ${PORT}"]