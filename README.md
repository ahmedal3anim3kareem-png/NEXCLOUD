# GitHub Cloud Storage

واجهة عربية لرفع الملفات إلى مجلد `uploads` داخل GitHub Repository، مع خدمة وسيطة آمنة باستخدام Cloudflare Workers.

## لماذا نحتاج Worker؟
GitHub Pages يستضيف ملفات ثابتة فقط. وضع GitHub token داخل HTML يكشفه لكل زائر؛ لذلك يحتفظ Worker بالمفتاح كـ Secret ويرسل طلبات GitHub نيابة عن الواجهة.

## 1) جهّز GitHub
1. أنشئ Repository جديداً، ويفضّل أن يكون **Private**.
2. أنشئ Fine-grained Personal Access Token بصلاحية Contents: Read and write لهذا المستودع فقط.
3. لا ترسل التوكن لأحد ولا تضعه في `index.html` أو أي ملف منشور.

## 2) انشر Worker
1. أنشئ Cloudflare Worker جديداً والصق محتوى `worker.js`.
2. من إعدادات Worker أضف:
   - Secret: `GITHUB_TOKEN` = التوكن.
   - Variable: `GITHUB_OWNER` = اسم حساب GitHub.
   - Variable: `GITHUB_REPO` = اسم المستودع.
   - Variable: `GITHUB_BRANCH` = اسم الفرع، غالباً `main`.
   - Variable: `ALLOWED_ORIGIN` = رابط GitHub Pages، مثل `https://USERNAME.github.io`.
3. انشر Worker وانسخ رابطه.

## 3) اربط الواجهة
افتح `index.html` واستبدل:
`PASTE_YOUR_WORKER_URL_HERE`
برابط Worker المنشور، ثم ارفع `index.html` إلى المستودع.

## 4) فعّل GitHub Pages
من Repository > Settings > Pages اختر النشر من الفرع `main` ومجلد `/ (root)` ثم احفظ. افتح رابط Pages.

## ملاحظات
- النسخة الحالية تعرض الملفات الموجودة مباشرة داخل `uploads` وتدعم الرفع والتنزيل/الفتح.
- حد الواجهة الحالي 25 MB لكل ملف. GitHub Contents API ليس مناسباً للفيديوهات الكبيرة أو التخزين السحابي واسع النطاق؛ الملفات الكبيرة تحتاج تخزيناً متخصصاً أو Git LFS مع إعدادات إضافية.
- المستودع الخاص أفضل للخصوصية، لكن تأكد من إعدادات الوصول قبل رفع أي ملفات.
- لا توجد حالياً ميزة حذف الملفات من الواجهة.
