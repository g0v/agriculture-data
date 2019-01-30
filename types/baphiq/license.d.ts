export interface EntryLicense {
  許可證號: string;
  化學成分: string;
  廠牌名稱: string;
  國外原製造廠商: string;
  有效期限: string;
  廠商名稱: string;
}

export interface License extends EntryLicense {
  許可證字: string;
  中文名稱: string;
  農藥代號: string;
  英文名稱: string;
}
