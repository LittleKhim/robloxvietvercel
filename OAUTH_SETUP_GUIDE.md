# Hướng Dẫn Cấu Hình Google OAuth với Appwrite

## Lỗi 400 từ Google OAuth

Lỗi này xảy ra khi redirect URI chưa được cấu hình đúng. Làm theo các bước sau:

## Bước 1: Chạy Website qua Web Server

**KHÔNG** mở file trực tiếp (file://). Phải chạy qua web server:

### Cách 1: VS Code Live Server (Khuyên dùng)
1. Cài extension "Live Server" trong VS Code
2. Click chuột phải vào `store.html` → "Open with Live Server"
3. Website sẽ mở tại: `http://127.0.0.1:5500/store.html` (hoặc port khác)

### Cách 2: Python
```bash
cd D:\portfolio-main
python -m http.server 8000
```
Mở: `http://localhost:8000/store.html`

### Cách 3: Node.js
```bash
cd D:\portfolio-main
npx http-server
```
Mở URL hiển thị (thường là `http://localhost:8080/store.html`)

## Bước 2: Cấu Hình Appwrite Platform (Web Platform)

### Cách Thêm Web Platform trong Appwrite:

1. **Vào Appwrite Console:**
   - Truy cập [https://cloud.appwrite.io](https://cloud.appwrite.io)
   - Đăng nhập vào tài khoản của bạn

2. **Chọn Project:**
   - Chọn project của bạn (Project ID: `690ec5bf00043292a7e0`)

3. **Vào Settings → Platforms:**
   - Click vào **Settings** ở menu bên trái
   - Chọn **Platforms** từ menu con

4. **Thêm Platform Mới:**
   - Click nút **"Add Platform"** hoặc **"Create Platform"**
   - Chọn **"Web App"** từ danh sách các loại platform

5. **Điền Thông Tin Platform:**

   **Cho Development (Localhost):**
   - **Name**: `Local Development` (hoặc tên bạn muốn)
   - **Type**: Web App
   - **Hostname**: `localhost` hoặc `127.0.0.1`
   - **Port**: 
     - Live Server: `5500` (hoặc port hiển thị)
     - Python: `8000`
     - Node.js: `8080` hoặc port bạn đang dùng
   - Click **"Create"** hoặc **"Save"**

   **Cho Production (Domain của bạn):**
   - **Name**: `Production` (hoặc tên bạn muốn)
   - **Type**: Web App
   - **Hostname**: `www.thelazy.store`
   - **Port**: (Để trống cho HTTPS, hoặc `443`)
   - Click **"Create"** hoặc **"Save"**

6. **Xác Nhận:**
   - Platform sẽ xuất hiện trong danh sách
   - Đảm bảo platform đã được kích hoạt (Active)

## Bước 3: Cấu Hình Google Cloud Console

1. Vào [Google Cloud Console](https://console.cloud.google.com)
2. Chọn project của bạn (hoặc tạo project mới)
3. Vào **APIs & Services** → **Credentials**
4. Tìm OAuth 2.0 Client ID của bạn (hoặc tạo mới nếu chưa có)
5. Click vào OAuth 2.0 Client ID để chỉnh sửa
6. Trong phần **Authorized redirect URIs**, thêm:
   ```
   https://sgp.cloud.appwrite.io/v1/account/sessions/oauth2/google
   ```
   ⚠️ **QUAN TRỌNG**: Đây là URL mà Appwrite sử dụng, KHÔNG phải localhost URL của bạn!

7. **Lưu lại**

## Bước 4: Cấu Hình Google OAuth trong Appwrite

1. Vào Appwrite Console → **Authentication** → **Providers**
2. Tìm **Google** provider và click để chỉnh sửa
3. Nhập:
   - **App ID**: Client ID từ Google Cloud Console
   - **App Secret**: Client Secret từ Google Cloud Console
4. **Lưu lại**

## Bước 5: Kiểm Tra

1. Chạy website qua web server (không phải file://)
2. Mở Console (F12) và kiểm tra:
   - "Appwrite SDK loaded successfully using ES modules"
   - "Initiating Google OAuth with: ..."
3. Click nút "Đăng nhập với Google"
4. Nếu vẫn lỗi, kiểm tra:
   - URL trong Console có đúng không?
   - Redirect URI trong Google Cloud Console có khớp không?

## Lưu Ý Quan Trọng

- **Redirect URI trong Google Cloud Console** phải là: `https://sgp.cloud.appwrite.io/v1/account/sessions/oauth2/google`
- **Platform trong Appwrite** phải khớp với URL bạn đang chạy (localhost:8000, etc.)
- **KHÔNG** dùng file:// - phải chạy qua HTTP/HTTPS

## Troubleshooting

### Lỗi 400 từ Google
- Kiểm tra redirect URI trong Google Cloud Console
- Đảm bảo đã thêm: `https://sgp.cloud.appwrite.io/v1/account/sessions/oauth2/google`

### Lỗi từ Appwrite về Invalid URI
- Đảm bảo đang chạy qua web server (không phải file://)
- Kiểm tra Platform trong Appwrite đã được thêm đúng chưa

### Không thấy nút đăng nhập
- Mở Console (F12) để xem lỗi
- Kiểm tra Appwrite SDK đã load chưa

