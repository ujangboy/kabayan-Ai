import { configure } from '@testing-library/dom';

// Timeout default Testing Library (1 detik) terlalu ketat saat seluruh suite
// berjalan paralel di mesin dev/CI yang sibuk. 5 detik tidak menutupi bug
// nyata, hanya mencegah flake "Unable to find element" karena antrean worker.
if (typeof document !== 'undefined') {
  configure({ asyncUtilTimeout: 5000 });
}
