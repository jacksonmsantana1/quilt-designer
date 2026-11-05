// The phone app. For now its first screen; My quiltings, My fabrics and the camera follow.
import { getLang } from '@quilt/shared/i18n.js';
import { initCommunity } from './community.js';

document.documentElement.lang = getLang();
initCommunity();
