"use client";

import React from "react";
import AdminLayout from "@/components/AdminLayout";
import { Typography, Card, Divider, Image } from "antd";

const { Title, Paragraph, Text } = Typography;

export default function ManualPage() {
  return (
    <AdminLayout>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Card>
          <Typography>
            <Title level={2}>📖 Hướng dẫn sử dụng Phần mềm Chấm công</Title>
            <Paragraph>
              Chào mừng bạn đến với hệ thống HRM (Quản lý nhân sự), phiên bản
              V.1.0.0. Phát triển bởi Nguyễn Thiện Minh Trí. Dưới đây là các
              bước cơ bản để sử dụng phần mềm.
              <p>
                Click vào{" "}
                <a
                  href="https://drive.google.com/file/d/1JmZaeR7wq4_abRDmTU5nbUJz55K87JgB/view?usp=sharing"
                  target="_blank"
                >
                  đường link này
                </a>{" "}
                để xem file hướng dẫn chi tiết
              </p>
            </Paragraph>

            <Divider />

            {/* PHẦN 1 */}
            <Title level={3}>1. Cách xem chấm công hàng ngày</Title>
            <Paragraph>
              Để xem chấm công, bạn hãy truy cập vào menu{" "}
              <Text strong>Tổng hợp công</Text>
            </Paragraph>
            <Paragraph>
              <ul>
                <li>
                  Chọn <Text code>Tháng</Text> đến <Text code>Nhà máy</Text> và{" "}
                  <Text code>Phòng ban</Text>.
                </li>
                <li>Hệ thống sẽ hiển thị danh sách nhân viên.</li>
                <li>Những ô màu xanh là đã đi làm, màu đỏ là vắng.</li>
              </ul>
            </Paragraph>

            {/* Nếu bạn muốn chèn ảnh hướng dẫn (bỏ ảnh vào thư mục public/images) */}
            {/* <Image src="/images/huong-dan-1.png" alt="Ảnh minh họa" /> */}

            <Divider />

            {/* PHẦN 2 */}
            <Title level={3}>2. Quy định về các ký hiệu</Title>
            <Paragraph>
              <ul>
                <li>
                  <Text strong>X:</Text> Đi làm cả ngày (Công 1.0)
                </li>
                <li>
                  <Text strong>X/2:</Text> Đi làm nửa ngày (Công 0.5)
                </li>
                <li>
                  <Text strong>P:</Text> Nghỉ phép năm
                </li>
                <li>
                  <Text strong>KL:</Text> Nghỉ không lương
                </li>
                <Text italic>Xem thêm ở danh mục ký hiệu chấm công</Text>
              </ul>
            </Paragraph>

            <Divider />

            {/* PHẦN 3 */}
            <Paragraph>
              <Title level={3}>3. Thực hiện chấm công</Title>
              <Paragraph>
                Để thực hiện chấm công, bạn hãy truy cập vào menu{" "}
                <Text strong>Chấm công</Text>
              </Paragraph>
              <Paragraph>
                <ul>
                  <li>
                    Chọn <Text code>Ngày</Text> rồi chọn{" "}
                    <Text code>Nhà máy</Text> sau đó <Text code>Phòng ban</Text>
                    . Nếu không chọn ngày thì mặc định lấy ngày hôm nay
                  </li>
                  <li>
                    Hệ thống sẽ hiển thị danh sách nhân viên của phòng ban được
                    chọn.
                  </li>
                  <li>
                    Có thể bấm nút tất cả đi làm để chấm nhanh, sau đó sửa lại
                    cho phù hợp với từng người như là: nghỉ phép, nghỉ ốm,vv...
                    cho phù hợp
                  </li>
                  <li>Sau đó nhấn nút LƯU BẢNG CÔNG là xong.</li>
                </ul>
              </Paragraph>
            </Paragraph>

            <Divider />

            <Paragraph>
              <Text italic style={{ color: "red" }}>
                Nếu gặp lỗi trong quá trình sử dụng, vui lòng liên hệ bộ phận
                IT: Mr Trí: 0984 857 190
              </Text>
            </Paragraph>
          </Typography>
        </Card>
      </div>
    </AdminLayout>
  );
}
