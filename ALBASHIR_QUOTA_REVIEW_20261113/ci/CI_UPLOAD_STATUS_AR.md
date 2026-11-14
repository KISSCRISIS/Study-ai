# حالة إصلاح CI — ALBASHIR

**المستودع:** `KISSCRISIS/Study-ai`  
**فرع الإصلاح:** `fix/albashir-pg16-ci-isolation-20261114`  
**القرار التشغيلي:** اختبارات المراجعة الاصطناعية PASS؛ قرار نشر النظام Production ما يزال NO-GO.

## الإصلاحات المطبقة

- حُفظ `ci/check_isolation.sh` في Git بصلاحية تنفيذ `100755`؛ كان سبب التعطل السابق حفظه بصلاحية `100644` مع استدعائه مباشرة.
- أضيف فحص داخل `run_ci.sh` يمنع تكرار خطأ صلاحية التنفيذ.
- عُدّل انتظار PostgreSQL ليختبر TCP على `127.0.0.1`؛ يتجنب اعتبار خادم التهيئة المؤقت داخل صورة PostgreSQL جاهزًا قبل الخادم النهائي.
- عُدّل فحص هوية الخادم ليستخدم TCP loopback نفسه.
- صُححت اختبارات Q14f_target_guards: التحقق من SQLSTATE `P0001` واسم القيد الفعلي، ثم التحقق من العدادات الأصلية لكل نطاق على حدة (emp=2, src=3, global=5).

## دليل التشغيل الفعلي

- **GitHub Actions Run:** [43540433686](https://github.com/KISSCRISIS/Study-ai/actions/runs/43540433686)
- **Commit المختبَر:** `450105d183b151b983b33c1cd70e0c626d046602`
- **PostgreSQL:** 16.16 (`server_version_num=160016`)
- **العزل:** Docker container مع `--network none` وبدون host ports.
- **النتيجة:** جميع الاختبارات المحددة نجحت: Q14f، Q14f_target_guards، Q14g، Q14h، Q14i_roles، Q14j_idempotency، Q14k_jwt_spoof، وQ14l same-lease concurrency.
- **Artifact:** [سجلات الاختبار وRESULTS.tsv](https://github.com/KISSCRISIS/Study-ai/actions/runs/43540433686/artifacts/14091940683)
- **SHA-256 للـArtifact:** `102eaa327fc5b3a18ebd41c6b14b4eb46f223a62718fa4a9443ffa13e76c9fac`

## حدود الإثبات

- هذه نتائج PostgreSQL 16 على مخطط وبيانات اصطناعية فقط؛ لا تثبت صلاحية Production ولا تغطي كل دورة حياة الحصة.
- توافق نموذج التفويض في v6.3 مع صلاحيات ALBASHIR الحقيقية ما يزال **SECURITY BLOCKED**؛ المرشح يعتمد ACL-only ولا توجد لقطة موثقة لهوية المستدعي والعضويات وACL الإنتاجية لحسمه.
- تعريفات CLAIM وCONSUME وFINALIZE وSUPERSEDE وEXPIRED/CLEANUP، وقرارات Q08/Q09 وRollback، ما تزال بحاجة إلى المصادر الأصلية ومراجعة مستقلة.
- لم يحدث أي اتصال بـProduction أو Staging، ولم يتغير `main`، ولم يُرفع قفل النشر.

**الخلاصة:** إصلاح CI واختبارات Q14f–Q14l المحددة اجتازت التشغيل الاصطناعي الفعلي. **Production NO-GO** حتى إغلاق العوائق الأمنية ومراجعة بقية مسارات النظام.
