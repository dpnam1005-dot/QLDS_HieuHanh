# Huong dan bao tri an toan

## Pham vi Dot 4

Dot 4 chi bao gom cac thay doi code va tai lieu. Khong sua du lieu dang co,
khong doi cau truc bang, khong doi RLS va khong chay migration tren Supabase.

Ban sao source truoc Dot 4:

`Backup data/code-before-phase4-2026-09-24`

## Cac thay doi da thuc hien

- Tap trung ten bang Supabase, khoa LocalStorage va thoi gian timeout trong `APP_CONFIG`.
- Dung lai ham `parseJsonArray()` cho viec doc lich su va cache JSON khong hop le.
- Giu nguyen gia tri ten bang, khoa cache, khoa trang hien tai va timeout 10 giay.
- Khong thay doi cac thao tac ghi/xoa/import du lieu.
- Tach them `js/core-shared.js` cho cau hinh/ham dung chung va `js/error-handler.js` cho hien thi loi.
- Thu tu nap hien tai: `core-shared` -> `error-handler` -> cac module phan tich/bao cao -> `script.js`.
- Cac module phan tich/bao cao/lich su chi doc `customers[].history[]`; cac lenh ghi database van chi nam trong `script.js`.

## Kiem tra an toan truoc khi su dung

1. Chay kiem tra cu phap: `node --check script.js`.
2. Dang nhap va kiem tra danh sach, lich su, dashboard va bao cao.
3. Dang xuat, dang nhap lai va xac nhan du lieu tai lai tu Supabase.
4. Kiem tra so luong khach hang va tong doanh so voi file backup truoc Dot 4.

Khong thu them, sua, xoa hoac nhap Excel tren du lieu that trong buoc kiem tra
neu chua co yeu cau rieng.

## Viec can phe duyet rieng

Bat ky thay doi nao co `insert`, `update`, `delete`, `upsert`, import Excel,
SQL migration, doi ten cot, doi ma khach hang, gop/xoa ban ghi hoac sua RLS
deu phai duoc sao luu va phe duyet rieng truoc khi thuc hien.
