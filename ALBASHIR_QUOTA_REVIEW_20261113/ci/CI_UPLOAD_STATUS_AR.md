# حالة نشر أداة الاختبار — ALBASHIR

- تم تجهيز أصول CI والاختبارات فقط للنشر على فرع `review/albashir-quota-v6-2-20261113`.
- لا تعديل على `main` ولا على مستودع ALBASHIR الأساسي ولا على أي قاعدة بيانات متصلة.
- `v6.2` باقٍ كما هو ومقفل.
- `v6.3` مرشح مراجعة **مقفل**؛ التغيير في نموذج التفويض إلى ACL-only غير معتمد للنشر، ويظل عائقًا أمنيًا مستقلًا.
- النسخة SQL المشتقة القابلة للتشغيل موجودة أثناء الاختبار فقط تحت `ci/generated/` ولا تُرفع.
- ملفات `ci/logs/` لا تُرفع إلى مستودع Git؛ تظهر بعد التنفيذ في GitHub Actions artifacts الاصطناعية.
- حاجز CI يستلزم حاوية PostgreSQL 16 مؤقتة مع `--network none` ويستخدم `docker exec` فقط؛ لا يوجد `DROP DATABASE`.
- الفحوص المحلية للملفات والنسخ المشتقة: **STATIC PASS**.
- تشغيل PostgreSQL 16 عبر GitHub Actions: **NOT RUN/UNKNOWN** قبل الحصول على سجل workflow الفعلي.
- مراجعة مسارات CLAIM/CONSUME/FINALIZE/SUPERSEDE/CLEANUP والصلاحيات الحقيقية وRollback: **BLOCKED**.

**قرار نشر النظام: NO-GO.** لا تعني نتيجة GitHub Actions الخضراء الموافقة على نشر الدالة.
