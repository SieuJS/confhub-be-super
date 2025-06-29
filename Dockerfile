# Dockerfile (Final Fix & Optimized for Production with PM2)

# ---- Stage 1: Dependencies & Build ----
# Giai đoạn này cài đặt tất cả dependencies (bao gồm cả dev) và build ứng dụng
FROM node:20-alpine AS builder

# Không đặt ENV NODE_ENV ở đây nữa để tránh ảnh hưởng đến npm install

WORKDIR /usr/src/app

# Sao chép package.json và lock file
COPY package*.json ./

# ĐIỀU CHỈNH QUAN TRỌNG NHẤT:
# Chạy "npm install" và thêm cờ --include=dev để buộc cài đặt devDependencies
# bất kể NODE_ENV là gì. Hoặc đơn giản là không set NODE_ENV trước lệnh này.
RUN npm install

# Sao chép toàn bộ mã nguồn
COPY . .

# Generate Prisma Client (cần thiết trước khi build)
RUN npx prisma generate

# Build ứng dụng cho production. Bây giờ lệnh "nest" chắc chắn đã tồn tại.
RUN npm run build

# Dọn dẹp: Xóa devDependencies để chuẩn bị cho stage production
RUN npm prune --production


# ---- Stage 2: Production Image ----
# Giai đoạn này tạo ra image cuối cùng, nhẹ hơn, chỉ chứa những gì cần thiết để chạy
FROM node:20-alpine

# Bây giờ mới đặt ENV NODE_ENV=production cho môi trường chạy cuối cùng
ENV NODE_ENV=production

WORKDIR /usr/src/app

# Sao chép các file đã build và node_modules đã được dọn dẹp từ stage 'builder'
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/prisma ./prisma

# Sao chép file cấu hình PM2 vào trong image
COPY ecosystem.config.js ./

# Cài đặt PM2 trên toàn cục trong image
RUN npm install pm2 -g

# Generate Prisma Client một lần nữa trong image cuối cùng (để chắc chắn)
RUN npx prisma generate

# Mở port mà ứng dụng sẽ chạy
EXPOSE 3000

# Lệnh để khởi động ứng dụng bằng PM2 khi container chạy
CMD ["pm2-runtime", "start", "ecosystem.config.js"]