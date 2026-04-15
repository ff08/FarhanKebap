# Farhan Urfa Kebap - QR Menu

Mobil odakli, iki dilli (TR/EN), Google Sheets destekli QR menu sayfasi.

## 1) Logo

Logo dosyasini su yola koyun:

- `assets/farhan-logo.png`

Mevcut projede logo referansi `index.html` icinde bu dosyaya bakar.

## 2) Google Sheets Hazirlama

Google Sheet'te ilk satir baslik olsun. Tavsiye edilen kolon adlari:

- `kategori_basligi`
- `kategori_basligi_en`
- `urun_adi`
- `urun_adi_en`
- `urun_icerigi`
- `urun_icerigi_en`
- `alerjen_madde`
- `alerjen_madde_en`
- `gramaj`
- `fiyat`
- `urun_gorseli_link`

Notlar:

- Fiyati olmayan urunlerde `fiyat` hucresini bos birakabilirsiniz. Ekranda "Ikram / Complimentary" gorunur.
- `fiyat` kolonu hic yoksa da sistem calisir.
- Gorsel yoksa otomatik `assets/no-image.svg` kullanilir.

## 3) Sheet Yayini

1. Google Sheets > **File** > **Share** > **Publish to web** ile yayinlayin.
2. Sheet linkini alin (ornek: `https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0`)
3. `app.js` icindeki `CONFIG.googleSheetUrl` degerine yapistirin.
4. `app.js` icindeki `CONFIG.sheetNames` listesine kullanacaginiz sekme adlarini yazin.

Ornek:

- `sheetNames: ["Lahmacunlar", "Kebaplar", "Icecekler", "Tatlilar"]`

Bu yapida:

- Her sekme bir kategori olarak okunur.
- `kategori_basligi` kolonu zorunlu degildir (isterseniz yine kullanabilirsiniz).
- Urunler o sekmenin kategorisinde listelenir.

## 4) Dil ve Mobil Kullanim

- Ustteki `TR / EN` butonu ile aninda dil degisir.
- Alttaki yatay kategori bar'i ile mobilde hizli gecis yapilir.
- Tasarim mobile-first olarak gelistirilmistir.

## 5) Yerel Calistirma

Sadece statik dosya olarak acabilirsiniz:

- `index.html` dosyasini tarayicida acin.

Canli ortamda HTTPS altinda yayinlamaniz onerilir.
