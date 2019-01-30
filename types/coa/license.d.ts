export interface License {
	許可證字: string;
	許可證號: string;
	中文名稱: string;
	農藥代號: string;
	英文名稱: string | null;
	廠牌名稱: string | null;
	化學成分: string;
	國外原製造廠商: string | null;
	有效期限: string;
	廠商名稱: string;
}

type URL = string;

export interface LicenseWithUsages extends License {
	農藥使用範圍: URL;
}
