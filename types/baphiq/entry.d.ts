import { EntryLicense, License } from './license';
import { Usage } from './usage';

export interface Entry {
  id: License['農藥代號'];
  name: License['中文名稱'];
  廠牌名稱: License['廠牌名稱'];
  作用機制: string;
  通過日期: string;
  licenses: EntryLicense[];
  usages: Usage[];
}
