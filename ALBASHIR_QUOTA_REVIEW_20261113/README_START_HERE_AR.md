# ALBASHIR — مرجع مراجعة حصة رفع الصور (13 نوفمبر 2026)

**الحالة: REVIEW ONLY / NO-GO.** هذا المجلد مصدر مرجعي للملفات المراد إصلاحها، وليس إصدارًا صالحًا للنشر.

## النسخة المعتمدة كبداية للمراجعة (وليس للنشر)
- `sql/REVIEW_ONLY_release_new_photo_upload_quota_v6_2_LOCAL_CANDIDATE.sql` — أحدث مرشح محلي متاح، أُعيد بناؤه من v6 وتعديلات v6.1؛ **ليس تعريفًا مستخرجًا من قاعدة Production**. يحتوي حاجز `$deployment_lock$` الذي يجب إبقاؤه.
- `tests/VERIFY_REPAIRS_STATIC.cjs` — فاحص أقدم معروف بخلل regex؛ **مطلوب إصلاحه**.
- `tests/sql/Q14f.sql` — اختبار تصادم أسماء القيود؛ يحتاج تدقيق قوة assertions وصياغة SQL.
- `tests/sql/Q14g.sql` — اختبار DEFERRED/IMMEDIATE؛ يحتاج إثبات الحالة الديناميكية للمستدعي.
- `tests/sql/Q14h.sql` — اختبار التراجع وإعادة المحاولة؛ يحتاج فحوص NULL/الموجودية الحقيقية.

## ملفات مساعدة
- `sql/READ_ONLY_FUNCTION_TRIGGER_INVENTORY.sql` — استعلام جرد فقط، **لم يُنفّذ** على قاعدة متصلة.
- `docs/Q08_Q09_POLICY_DECISION_TEMPLATE_AR.md` — مسودة سياسة غير معتمدة.
- `docs/QA_MATRIX_AND_LIMITATIONS.md` و`docs/INDEPENDENT_V6_2_REVIEW_AR.md` — سياق المراجعة التاريخي؛ لا تعتمد على ادعاءات PASS دون سجلات.

## ما يلزم إنجازه
1. مراجعة وتحسين `v6.2` دون الاعتماد على تعليقات الإصلاح القديمة كدليل نجاح.
2. إصلاح فاحص Static، واختبارات Q14f/Q14g/Q14h قبل تشغيلها؛ **من ضمن الأخطاء المرصودة** في نسخ الاختبارات السابقة تعريف `scope_key text PRIMARY KEY COLLATE "C"` بدل `scope_key text COLLATE "C" PRIMARY KEY`.
3. تشغيل PostgreSQL 16 على حاوية اصطناعية معزولة وبدون أي اتصال إلى قواعد ALBASHIR المتصلة؛ تسجيل SQLSTATE ونتائج كل اختبار.
4. التحقق من جميع مسارات CLAIM/CONSUME/SUPERSEDE/RELEASE/FINALIZE/CLEANUP وترتيب الأقفال.
5. استخراج Snapshot قراءة فقط **فقط بعد إذن مستقل**، وإعداد Rollback حقيقي من تعريف سابق مؤكد.

## العوائق المستمرة
- لا تتوفر النسخ الأصلية المؤكدة للملفات الثلاثة:
  `supabase/review/NEW_ONLY_PHOTO_UPLOAD_QUOTA_REVIEW_LOCKED.sql`
  `supabase/review/NEW_ONLY_ATOMIC_PHOTO_ATTEST_FINALIZE_REVIEW_LOCKED.sql`
  `supabase/review/NEW_ONLY_QUOTA_RELEASE_DEADLOCK_REVIEW_LOCKED.sql`
- PostgreSQL 16 الحقيقي: **NOT RUN** في المراجعة السابقة.
- Q08/Q09 وRollback وACL الفعلي: **BLOCKED**.
- لا يوجد إثبات شامل لغياب Deadlock أو سلامة FINALIZE وHTTP 201.

**المستودع عام (Public).** يمنع إضافة مفاتيح API، أو معلومات اتصال، أو بيانات موظفين، أو صور، أو مخرجات جرد حساسة.

**لا تعديل على main، ولا دمج، ولا نشر، ولا تنفيذ SQL على Production/Staging.** هذا الفرع خاص بملفات المراجعة.
