"use client";

import React, { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import CommonFilter, { FilterResult } from "@/components/CommonFilter";
import { Button, Card, Typography, message, Table, Alert } from "antd";
import { DownloadOutlined, SyncOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const { Title, Text } = Typography;

export default function ExportBravoPage() {
    const [loading, setLoading] = useState(false);
    const [currentFilter, setCurrentFilter] = useState<FilterResult | null>(null);

    // Lưu preview data để user yên tâm là có dữ liệu
    const [previewData, setPreviewData] = useState<any[]>([]);

    // Bắt sự kiện khi đổi bộ lọc
    const handleFilterChange = (result: FilterResult) => {
        setCurrentFilter(result);
        setPreviewData([]); // Clear preview khi đổi điều kiện
    };

    // Hàm gọi API và Tạo file Excel
    const handleExport = async () => {
        if (!currentFilter) return;

        setLoading(true);
        message.loading({ content: "Đang tổng hợp dữ liệu, vui lòng đợi...", key: "export" });

        try {
            const month = currentFilter.date.month() + 1;
            const year = currentFilter.date.year();

            let url = `/api/bravo-data/bravo?month=${month}&year=${year}`;

            // Nếu có chọn phòng ban / nhà máy thì thêm vào URL (Không chọn = Xuất tất cả)
            if (currentFilter.factoryId) url += `&factoryId=${currentFilter.factoryId}`;
            if (currentFilter.realDepartmentIds.length > 0) {
                url += `&departmentId=${currentFilter.realDepartmentIds.join(",")}`;
            }
            if (currentFilter.selectedKipIds.length > 0) {
                url += `&kipIds=${currentFilter.selectedKipIds.join(",")}`;
            }

            // 1. Fetch Dữ liệu phẳng
            const res = await fetch(url);
            const data = await res.json();

            if (data.error) throw new Error(data.error);
            if (data.length === 0) {
                message.warning({ content: "Không có dữ liệu trong khoảng thời gian này.", key: "export" });
                setLoading(false);
                return;
            }

            // Lưu 10 dòng đầu để Preview
            setPreviewData(data.slice(0, 10));

            // 2. Tạo File Excel
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("DuLieuBravo");

            // Khai báo cột Header chính xác
            worksheet.columns = [
                { header: "Ngày", key: "ngay", width: 12 },
                { header: "Nhân viên nhập công", key: "nvNhap", width: 20 },
                { header: "Bộ phận", key: "boPhan", width: 15 },
                { header: "Mã công thời gian", key: "maCongThoiGian", width: 18 },
                { header: "Mã nhân viên", key: "maNv", width: 15 },
                { header: "Tên nhân viên", key: "tenNv", width: 25 },
                { header: "Mã công", key: "maCong", width: 12 },
                { header: "Loại công", key: "loaiCong", width: 25 },
            ];

            // Đẩy dữ liệu vào Sheet
            worksheet.addRows(data);

            // (Tùy chọn) Định dạng nhẹ cho Header (In đậm)
            worksheet.getRow(1).font = { bold: true };

            // 3. Tải file về
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            saveAs(blob, `DuLieu_BRAVO_T${month}_${year}.xlsx`);

            message.success({ content: `Xuất thành công ${data.length} dòng dữ liệu!`, key: "export" });

        } catch (error: any) {
            console.error(error);
            message.error({ content: "Lỗi kết xuất: " + error.message, key: "export" });
        } finally {
            setLoading(false);
        }
    };

    // Cột cho bảng Preview UI
    const columns = [
        { title: "Ngày", dataIndex: "ngay" },
        { title: "NV Nhập", dataIndex: "nvNhap" },
        { title: "Mã Bộ phận", dataIndex: "boPhan" },
        { title: "Mã công TG", dataIndex: "maCongThoiGian" },
        { title: "Mã NV", dataIndex: "maNv" },
        { title: "Tên NV", dataIndex: "tenNv" },
        { title: "Mã công", dataIndex: "maCong" },
        { title: "Loại công", dataIndex: "loaiCong" },
    ];

    return (
        <AdminLayout>
            <div style={{ marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Kết xuất dữ liệu cho BRAVO</Title>
                <Text type="secondary">Xuất dữ liệu chấm công theo định dạng chuẩn để Import vào phần mềm BRAVO.</Text>
            </div>

            <CommonFilter
                dateMode="month"
                onFilterChange={handleFilterChange}
            />

            <Card style={{ marginTop: 16 }}>
                <Alert
                    message="Lưu ý quan trọng"
                    description="Nếu không chọn Nhà máy / Phòng ban ở bộ lọc trên, hệ thống sẽ tự động quét và kết xuất dữ liệu của TOÀN BỘ CÔNG TY. Quá trình này có thể mất vài giây do dữ liệu lớn."
                    type="info"
                    showIcon
                    style={{ marginBottom: 20 }}
                />

                <Button
                    type="primary"
                    size="large"
                    icon={loading ? <SyncOutlined spin /> : <DownloadOutlined />}
                    onClick={handleExport}
                    loading={loading}
                    style={{ background: "#217346", width: 250, height: 50, fontSize: 16 }}
                >
                    BẮT ĐẦU KẾT XUẤT EXCEL
                </Button>
            </Card>

            {/* Hiển thị bảng Preview nếu có */}
            {previewData.length > 0 && (
                <Card title="Dữ liệu xem trước (10 dòng đầu tiên)" size="small" style={{ marginTop: 16 }}>
                    <Table
                        dataSource={previewData}
                        columns={columns}
                        pagination={false}
                        size="small"
                        rowKey={(r) => r.maNv + r.ngay}
                    />
                </Card>
            )}

        </AdminLayout>
    );
}