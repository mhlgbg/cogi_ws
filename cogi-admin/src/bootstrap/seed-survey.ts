export const seedSurvey = async (strapi: any) => {
  const tenantId = 3;

  strapi.log.info("🚀 Seed Survey START");

  // =========================================================
  // CHECK EXISTING
  // =========================================================

  const existing = await strapi.db
    .query("api::survey-template.survey-template")
    .findOne({
      where: {
        code: "TEACHING_EVALUATION",
        tenant: tenantId,
      },
    });

  if (existing) {
    strapi.log.info("⛔ Survey đã tồn tại → skip seed");
    return;
  }

  // =========================================================
  // HELPERS
  // =========================================================

  const createTemplate = async (data: any) =>
    strapi.entityService.create("api::survey-template.survey-template", {
      data: { ...data, tenant: tenantId },
    });

  const createSection = async (templateId: number, title: string, order: number) =>
    strapi.entityService.create("api::survey-section.survey-section", {
      data: {
        title,
        order,
        survey_template: templateId,
        tenant: tenantId,
      },
    });

  const createQuestion = async (
    sectionId: number,
    content: string,
    type: string,
    order: number
  ) =>
    strapi.entityService.create("api::survey-question.survey-question", {
      data: {
        content,
        type,
        order,
        isRequired: true,
        survey_section: sectionId,
        tenant: tenantId,
      },
    });

  const createOptions = async (questionId: number, labels: string[]) => {
    for (let i = 0; i < labels.length; i++) {
      await strapi.entityService.create(
        "api::survey-question-option.survey-question-option",
        {
          data: {
            label: labels[i],
            value: String(i + 1),
            order: i + 1,
            survey_question: questionId,
            tenant: tenantId,
          },
        }
      );
    }
  };

  const LIKERT = [
    "1 - Kém",
    "2 - Trung bình",
    "3 - Khá",
    "4 - Tốt",
    "5 - Rất tốt",
  ];

  const AGREEMENT = [
    "1 - Hoàn toàn không đồng ý",
    "2 - Không đồng ý",
    "3 - Bình thường",
    "4 - Đồng ý",
    "5 - Hoàn toàn đồng ý",
  ];

  const createLikertSection = async (
    templateId: number,
    title: string,
    questions: string[],
    order: number,
    scale: string[]
  ) => {
    const section = await createSection(templateId, title, order);
    for (let i = 0; i < questions.length; i++) {
      const q = await createQuestion(section.id, questions[i], "LIKERT_1_5", i + 1);
      await createOptions(q.id, scale);
    }
  };

  // =========================================================
  // TEMPLATE 1: KHẢO SÁT GIẢNG DẠY
  // =========================================================

  const t1 = await createTemplate({
    name: "Khảo sát giảng dạy",
    code: "TEACHING_EVALUATION",
    type: "TEACHING_EVALUATION",
    isActive: true,
  });

  await createLikertSection(t1.id, "CÔNG TÁC CHUẨN BỊ GIẢNG DẠY", [
    "Mục tiêu và chuẩn đầu ra rõ ràng",
    "Phương pháp học tập rõ ràng",
    "Phương thức đánh giá rõ ràng",
    "Giới thiệu tài liệu đầy đủ",
  ], 1, LIKERT);

  await createLikertSection(t1.id, "PHƯƠNG PHÁP GIẢNG DẠY", [
    "Trình bày rõ ràng",
    "Kết hợp nhiều phương pháp",
    "Sử dụng phương tiện hiệu quả",
    "Giải đáp thắc mắc",
    "Khuyến khích tham gia",
    "Phát huy tự học",
  ], 2, LIKERT);

  await createLikertSection(t1.id, "NỘI DUNG GIẢNG DẠY", [
    "Đầy đủ theo lịch trình",
    "Liên hệ thực tế",
    "Phù hợp chuẩn đầu ra",
    "Logic và rõ ràng",
    "Được cập nhật",
    "Gắn nghề nghiệp",
  ], 3, LIKERT);

  await createLikertSection(t1.id, "KIỂM TRA ĐÁNH GIÁ", [
    "Công bằng",
    "Công khai tiêu chí",
    "Phù hợp nội dung",
    "Phản hồi kịp thời",
  ], 4, LIKERT);

  await createLikertSection(t1.id, "TÁC PHONG SƯ PHẠM", [
    "Trang phục phù hợp",
    "Tôn trọng sinh viên",
    "Môi trường thân thiện",
    "Ngôn ngữ rõ ràng",
    "Tạo hứng thú",
    "Khuyến khích sáng tạo",
    "Phối hợp phương pháp",
    "Sử dụng phương tiện tốt",
    "Hướng dẫn tự học",
    "Phân bổ thời gian hợp lý",
  ], 5, LIKERT);

  const secText1 = await createSection(t1.id, "Ý KIẾN KHÁC", 6);
  await createQuestion(secText1.id, "Điều hài lòng nhất", "TEXT", 1);
  await createQuestion(secText1.id, "Điều chưa hài lòng", "TEXT", 2);
  await createQuestion(secText1.id, "Đề xuất cải thiện", "TEXT", 3);

  // =========================================================
  // TEMPLATE 2: KHẢO SÁT TỐT NGHIỆP
  // =========================================================

  const t2 = await createTemplate({
    name: "Khảo sát trước tốt nghiệp",
    code: "GRADUATION_EXIT",
    type: "GRADUATION_EXIT",
    isActive: true,
  });

  await createLikertSection(t2.id, "CHƯƠNG TRÌNH ĐÀO TẠO", [
    "Chuẩn đầu ra rõ ràng",
    "Đáp ứng chuẩn đầu ra",
    "Thiết kế logic",
    "Phân bổ hợp lý",
    "Có học phần tự chọn",
    "Phù hợp xã hội",
    "Thông tin đầy đủ",
  ], 1, AGREEMENT);

  await createLikertSection(t2.id, "GIẢNG VIÊN", [
    "Có trách nhiệm",
    "Giảng rõ ràng",
    "Phương pháp tốt",
    "Liên hệ thực tế",
    "Chuyên môn cao",
    "Cập nhật nội dung",
    "Cung cấp tài liệu",
  ], 2, AGREEMENT);

  await createLikertSection(t2.id, "NHÂN VIÊN & CỐ VẤN", [
    "Hỗ trợ nhiệt tình",
    "Thái độ tôn trọng",
    "Đáp ứng công việc",
    "Cố vấn dễ hiểu",
    "Lắng nghe sinh viên",
  ], 3, AGREEMENT);

  await createLikertSection(t2.id, "TỔ CHỨC ĐÀO TẠO", [
    "Thông báo kết quả kịp thời",
    "Hình thức thi phù hợp",
    "Thực tập cần thiết",
    "Đánh giá công bằng",
    "Được phản hồi lãnh đạo",
  ], 4, AGREEMENT);

  await createLikertSection(t2.id, "CƠ SỞ VẬT CHẤT", [
    "Thư viện đầy đủ",
    "Tài liệu cập nhật",
    "Thư viện điện tử",
    "Phòng học",
    "Máy tính",
    "Hệ thống máy tính",
    "Wifi",
    "Đường truyền",
    "Phòng thực hành",
    "Kỹ năng mềm",
    "Môi trường",
  ], 5, AGREEMENT);

  await createLikertSection(t2.id, "HỖ TRỢ SINH VIÊN", [
    "Chính sách đầy đủ",
    "Ký túc xá",
    "Y tế",
    "Tư vấn",
    "Đoàn hội",
    "Văn hóa",
    "Thể thao",
    "Sinh hoạt",
    "Giáo dục đạo đức",
  ], 6, AGREEMENT);

  await createLikertSection(t2.id, "KIỂM TRA ĐÁNH GIÁ", [
    "Đa dạng hình thức",
    "Nghiêm túc",
    "Tiêu chí rõ ràng",
  ], 7, AGREEMENT);

  await createLikertSection(t2.id, "ĐÁP ỨNG KHÓA HỌC", [
    "Đáp ứng mục tiêu",
    "Đủ kiến thức nghề",
    "Đủ kỹ năng",
    "Đạo đức nghề",
    "Nghiên cứu",
    "Tự tin nghề nghiệp",
  ], 8, AGREEMENT);

  const secText2 = await createSection(t2.id, "Ý KIẾN CUỐI", 9);
  await createQuestion(secText2.id, "Điều hài lòng nhất", "TEXT", 1);
  await createQuestion(secText2.id, "Điều chưa hài lòng", "TEXT", 2);
  await createQuestion(secText2.id, "Đề xuất cải thiện", "TEXT", 3);

  strapi.log.info("✅ Seed Survey DONE");
};