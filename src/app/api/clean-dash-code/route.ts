import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(request: Request) {
  try {
    // 1. Kiểm tra quyền (Chỉ Admin mới được chạy lệnh này)
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Không có quyền thực hiện" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action"); // Lấy tham số hành động

    // 2. Tìm ID của mã công "--" trong danh mục
    const dashCode = await prisma.attendanceCode.findFirst({
      where: { code: "--" },
    });

    if (!dashCode) {
      return NextResponse.json({
        message: "Tuyệt vời! Không tìm thấy mã công '--' nào trong danh mục.",
      });
    }

    // 3. Đếm số lượng bản ghi chấm công đang dùng mã "--" này
    const count = await prisma.timesheet.count({
      where: { attendanceCodeId: dashCode.id },
    });

    // 4. CHẾ ĐỘ 1: CHỈ XEM (DRY RUN) - Chạy an toàn không mất dữ liệu
    if (action !== "delete") {
      return NextResponse.json({
        status: "SAFE_MODE",
        message: `Hệ thống tìm thấy ${count} bản ghi chấm công đang chứa ký hiệu '--'.`,
        instruction:
          "Để XÓA THỰC SỰ toàn bộ dữ liệu rác này, hãy thêm '?action=delete' vào cuối thanh địa chỉ URL và nhấn Enter.",
      });
    }

    // 5. CHẾ ĐỘ 2: THỰC THI XÓA (Khi có ?action=delete)
    const deleted = await prisma.timesheet.deleteMany({
      where: { attendanceCodeId: dashCode.id },
    });

    return NextResponse.json({
      status: "SUCCESS",
      message: `ĐÃ XÓA THÀNH CÔNG ${deleted.count} bản ghi chấm công chứa ký hiệu '--'. Hệ thống đã sạch sẽ!`,
    });
  } catch (error: any) {
    console.error("Lỗi xóa dữ liệu:", error);
    return NextResponse.json(
      { error: "Lỗi server: " + error.message },
      { status: 500 },
    );
  }
}
