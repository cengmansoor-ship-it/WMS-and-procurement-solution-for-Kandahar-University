# د وروستي اصلاحاتو راپور

## اصلاح شوي مهم کارونه

- د login/logout جریان ثابت شو.
- پروژه د `npm install` او `npm run dev` لپاره چمتو ده.
- وچ template او ecommerce/demo برخې د UI له رسمي workflow څخه لرې شوې.
- اصلي ۱۰ مینوګانې جوړې شوې: عمومي پاڼه، موجودي، ترلاسه کول، تدارکات، غوښتنې، فورمونه، خبرتیاوې، راپورونه، تنظیمات، زموږ په اړه.
- اووه رسمي فورمونه د اصلي HTML فایل څخه په جلا iframe کې خلاصیږي.
- د تدارکاتو برخه رسمي فورمونو ته وصل شوې: جګړه پاڼه، مقایسوي فورم، آمر خریداري.
- د ترلاسه کولو برخه رسمي فورمونو ته وصل شوې: راپور رسید، ف س ۵.
- د غوښتنو برخه د پیشنهاد او سیو ۹ سره کار کوي.
- Request Level په غوښتنو، فورمونو، راپورونو، پایپ لاین او خبرتیاوو کې ښکاري.
- Local one-year demo data د موجودۍ، حرکاتو، غوښتنو، پایپ لاین او وړاندوینې لپاره اضافه شوه.
- د اکسل-compatible backup ډاونلوډ اضافه شو.
- د ایمیل/خبرتیا history او mail client opening اضافه شو.
- د فایربیس اتصال لارښود اضافه شو.
- Bahij Zar font stack په UI کې تطبیق شو.
- تاریخونه د ښکاره UI لپاره هجري شمسي/قمري utilities کاروي.
- د account creation عام signup route بند شو؛ حساب جوړول یوازې د سوپر اډمین له لارې تشریح شوي.
- GitHub token په frontend کې نه ساتل کېږي.

## مهم محدودیتونه

- د Firebase Auth seed users په اتومات ډول له frontend څخه جوړول خوندي نه دي؛ دا باید د Firebase Console، Admin SDK، یا backend له لارې وشي.
- GitHub backup push د خوندي backend token/OAuth پرته له frontend څخه نه دی فعال شوی؛ local backup کار کوي.
- حقیقي SMTP email د backend پرته نه شي استول کېدای؛ موجود حل email client خلاصوي او history خوندي کوي.

## چک شوی

- `npm run build` کامیاب شو.
- visible AI tool references له فعال project څخه پاک شول.
- old ecommerce/template official workflow نه کارېږي.

## چلول

```powershell
npm install
npm run dev
```

## د فایربیس اتصال

`README-FIREBASE-CONNECTION.md` وګورئ.
