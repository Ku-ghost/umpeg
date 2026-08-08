/**
 * ============================================================
 * UNIFIED PEGAWAI DATA STRUCTURE & SYNC LOGIC
 * ============================================================
 * Sinkronisasi data pegawai antara:
 * 1. index.html (Portal Pegawai - Self Service)
 * 2. umpeg.html (Portal Admin - Verifikasi & Monitoring)
 * 
 * Updated: 2026-08-08
 * Backend: Supabase (table: pegawai_lemari_digital)
 * 
 * MAP COLOR STANDARD:
 * - BIRU   : PNS
 * - KUNING : PPPK
 * - HIJAU  : Kontrak
 * - MERAH  : Honorer
 * ============================================================
 */

// ============================================================
// 1. MAPPING STATUS KEPEGAWAIAN KE MAP COLOR (PERBAIKAN)
// ============================================================

const STATUS_MAP_COLOR = {
    "PNS": {
        color: "BIRU",
        bgColor: "blue-100",
        textColor: "blue-950",
        borderColor: "blue-300",
        icon: "fa-folder"
    },
    "PPPK (Penuh Waktu)": {
        color: "KUNING",
        bgColor: "amber-100",
        textColor: "amber-950",
        borderColor: "amber-300",
        icon: "fa-folder"
    },
    "PPPK (Paruh Waktu)": {
        color: "KUNING",
        bgColor: "amber-100",
        textColor: "amber-950",
        borderColor: "amber-300",
        icon: "fa-folder"
    },
    "Kontrak": {
        color: "HIJAU",
        bgColor: "green-100",
        textColor: "green-950",
        borderColor: "green-300",
        icon: "fa-folder"
    },
    "Honorer": {
        color: "MERAH",
        bgColor: "rose-100",
        textColor: "rose-950",
        borderColor: "rose-300",
        icon: "fa-folder"
    }
};

// ============================================================
// 2. KATEGORISASI PEGAWAI (SUB1 & SUB2)
// ============================================================

const PEGAWAI_KATEGORISASI = {
    // SUB1: MEDIS vs NON-MEDIS
    MEDIS_KEYWORDS: [
        "Dokter", "Perawat", "Bidan", "Nakes", "Apoteker", "Medis",
        "Keperawatan", "Kebidanan", "Farmasi", "Gigi", "Anestesi", "Radiologi",
        "Laboratorium", "Nutrisi", "Fisioterapi", "Kesehatan Masyarakat", "Sanitarian"
    ],

    // SUB2: STRUKTURAL vs FUNGSIONAL
    STRUKTURAL_KEYWORDS: [
        "Direktur", "Kepala", "Kasubag", "Kasi", "Kabid", "Kabag",
        "Eselon", "Manager", "Koordinator", "Supervisor"
    ]
};

// ============================================================
// 3. ALUR DATA SISTEM
// ============================================================

/**
 * ALUR INPUT DATA (index.html → Supabase → umpeg.html):
 *
 * 1. PEGAWAI MENGISI FORM di index.html
 *    └─ Klik "Simpan Seluruh Profil Kedinasan"
 *
 * 2. DATA DIVALIDASI & DITRANSFORM
 *    ├─ field detail_personal (nama, nik, kk, dll)
 *    ├─ field detail_jabatan (jabatan, golongan, eselon, sk)
 *    ├─ field detail_medis (str, sip, org profesi)
 *    ├─ field riwayat_pendidikan (array ijazah)
 *    └─ field link_url_drive (map berkas digital)
 *
 * 3. TRANSFORM KE FORMAT SUPABASE
 *    ├─ status_kepegawaian (PNS, PPPK, Kontrak, Honorer)
 *    ├─ map_status (BIRU, KUNING, HIJAU, MERAH)
 *    ├─ sub1 (MEDIS / NON-MEDIS) - auto-detect dari jabatan
 *    ├─ sub2 (FUNGSIONAL / STRUKTURAL) - auto-detect dari jabatan
 *    └─ verifikasi_status: "PENDING" (menunggu admin)
 *
 * 4. SYNC KE SUPABASE
 *    └─ Upsert ke table pegawai_lemari_digital
 *       (CREATE jika baru, UPDATE jika sudah ada)
 *
 * 5. ADMIN MELIHAT DI umpeg.html
 *    ├─ Tab "Verifikasi Bundel (A-H)"
 *    ├─ Tampil daftar pegawai dengan STATUS AUDIT
 *    ├─ Admin bisa klik "Edit", "Audit", atau "Approve"
 *    └─ Perubahan tersinkron realtime (Supabase Realtime)
 *
 * 6. PEGAWAI MELIHAT HASIL VERIFIKASI DI index.html
 *    ├─ Status badge: "✅ TERVERIFIKASI" / "🔴 PERLU PERBAIKAN"
 *    └─ Catatan audit terlihat di correction banner
 */

// ============================================================
// 4. STRUKTUR DATA UNIFIED (KONSISTEN)
// ============================================================

const PEGAWAI_UNIFIED_STRUCTURE = {
    // IDENTITAS UTAMA
    id_pegawai: "RSUD-PEG-XXXXXXXX",         // Generate otomatis
    nip: "198811052015022001",                // NIP 18 digit atau SK Kedinasan
    username: "username_pegawai",
    nama: "Nama Lengkap Pegawai",

    // STATUS & KATEGORI
    status_kepegawaian: "PNS",                // PNS / PPPK / Kontrak / Honorer
    map_status: "BIRU",                       // BIRU / KUNING / HIJAU / MERAH
    sub1: "MEDIS",                            // MEDIS / NON-MEDIS
    sub2: "FUNGSIONAL",                       // FUNGSIONAL / STRUKTURAL

    // KEDINASAN UTAMA
    jabatan: "Dokter Spesialis Penyakit Dalam",
    ruangan: "Poli Spesialis Rawat Jalan",
    golongan: "III.b",
    eselon: null,                             // Hanya untuk STRUKTURAL

    // DETAIL PERSONAL (nested object)
    detail_personal: {
        nama_lengkap: "Nama Lengkap (Tanpa Gelar)",
        gelar_depan: "Dr.",
        gelar_belakang: "Sp.Pd",
        nik: "7317XXXXXXXXXXXX",
        kk: "7317XXXXXXXXXXXX",
        tempat_lahir: "Sinjai",
        tgl_lahir: "1988-11-05",
        jk: "Laki-Laki",
        agama: "Islam",
        gol_darah: "A",
        status_nikah: "Kawin",
        hp: "628123456789",
        email: "pegawai@sinjaikab.go.id",
        alamat_ktp: "Jl. Sudirman No. 47",
        alamat_domisili: "Sinjai Utara",
        npwp: "12.345.678.9-012.345",
        bpjs: "0001234567890"
    },

    // DETAIL JABATAN (nested object)
    detail_jabatan: {
        status_kepegawaian: "PNS",
        golongan: "III.b",
        eselon: null,
        taspen: "12345678",
        karpeg: "12345678",
        jabatan_struktural: null,              // Jika STRUKTURAL
        no_sk_struktural: null,
        tgl_sk_struktural: null,
        tmt_sk_struktural: null,
        jabatan_fungsional: "Dokter Spesialis",// Jika FUNGSIONAL
        kelompok_fungsional: "JFT",
        jenjang_fungsional: "Ahli Madya",
        no_sk_fungsional: "SK-123/2023",
        tmt_sk_fungsional: "2023-01-01"
    },

    // DETAIL MEDIS (khusus NAKES)
    detail_medis: {
        no_str: "120152120-3341",
        tgl_str: "2020-01-15",
        exp_str: "2030-01-15",
        str_lifetime: false,
        no_sip: "503/014/SIP-DR/DPMPTSP",
        tgl_sip: "2020-02-01",
        exp_sip: "2025-02-01",
        org_profesi: "IDI",
        no_anggota_org: "181105/IDI/7307"
    },

    // RIWAYAT PENDIDIKAN (array)
    riwayat_pendidikan: [
        {
            jenjang: "S1",
            institusi: "Universitas Hasanuddin",
            prodi: "Ilmu Keperawatan",
            no_ijazah: "2015-001234",
            ipk: "3.75",
            tgl_lulus: "2015-05-15"
        }
    ],

    // BERKAS DIGITAL (map/object)
    link_url_drive: {
        "a_1": {
            label: "STR dan SIP",
            url: "https://drive.google.com/file/d/xxx",
            tgl_upload: "2026-01-15"
        },
        "a_2": {
            label: "Biodata & DRH",
            url: "https://drive.google.com/file/d/yyy",
            tgl_upload: "2026-01-16"
        }
    },

    // VERIFIKASI ADMIN
    verifikasi_status: "PENDING",             // PENDING / TERVERIFIKASI / PERLU_PERBAIKAN
    verifikasi_catatan: "",                   // Catatan dari admin jika perlu perbaikan

    // METADATA
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-01T10:00:00Z"
};

// ============================================================
// 5. FUNGSI HELPER - TRANSFORM DATA
// ============================================================

/**
 * STEP 1: Transform dari Form index.html ke Format Supabase
 * 
 * INPUT: Semua field dari form (f-bas-*, f-st-*, f-fn-*, f-med-*, dll)
 * OUTPUT: Object siap untuk Supabase upsert
 */
function transformFormToSupabase(formData) {
    const {
        idPegawai,
        nip,
        username,
        nama,
        status_kepegawaian,
        jabatan,
        ruangan,
        detail_personal,
        detail_jabatan,
        detail_medis,
        riwayat_pendidikan,
        link_url_drive
    } = formData;

    // AUTO-DETECT SUB1 (MEDIS/NON-MEDIS)
    const sub1 = determineSub1(jabatan);

    // AUTO-DETECT SUB2 (FUNGSIONAL/STRUKTURAL)
    const sub2 = determineSub2(jabatan);

    // TENTUKAN MAP_STATUS dari status_kepegawaian
    const mapColor = STATUS_MAP_COLOR[status_kepegawaian] || STATUS_MAP_COLOR["Honorer"];

    // EKSTRAK GOLONGAN
    const golongan = detail_jabatan?.golongan || "-";

    // EKSTRAK ESELON (hanya jika STRUKTURAL)
    const eselon = sub2 === "STRUKTURAL" ? detail_jabatan?.eselon : null;

    return {
        // IDENTITAS
        id_pegawai: idPegawai,
        nip: nip,
        username: username,
        nama: nama,

        // STATUS & KATEGORI
        status_kepegawaian: status_kepegawaian,
        map_status: mapColor.color,              // ✅ BIRU / KUNING / HIJAU / MERAH
        sub1: sub1,                              // AUTO-DETECT
        sub2: sub2,                              // AUTO-DETECT

        // KEDINASAN
        jabatan: jabatan,
        ruangan: ruangan,
        golongan: golongan,
        eselon: eselon,

        // DETAIL (pass-through)
        detail_personal: detail_personal || {},
        detail_jabatan: detail_jabatan || {},
        detail_medis: detail_medis || {},
        riwayat_pendidikan: riwayat_pendidikan || [],

        // BERKAS DIGITAL
        link_url_drive: link_url_drive || {},

        // VERIFIKASI (default PENDING)
        verifikasi_status: "PENDING",
        verifikasi_catatan: "",

        // METADATA
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

/**
 * STEP 2: Transform dari Supabase ke Format Display (index.html)
 * 
 * Untuk menampilkan & edit data pegawai yang sudah tersimpan
 */
function transformSupabaseToForm(supabaseRecord) {
    return {
        idPegawai: supabaseRecord.id_pegawai,
        nip: supabaseRecord.nip,
        username: supabaseRecord.username,
        nama: supabaseRecord.nama,
        status_kepegawaian: supabaseRecord.status_kepegawaian,
        map_status: supabaseRecord.map_status,
        sub1: supabaseRecord.sub1,
        sub2: supabaseRecord.sub2,
        jabatan: supabaseRecord.jabatan,
        ruangan: supabaseRecord.ruangan,
        golongan: supabaseRecord.golongan,
        eselon: supabaseRecord.eselon,
        detail_personal: supabaseRecord.detail_personal || {},
        detail_jabatan: supabaseRecord.detail_jabatan || {},
        detail_medis: supabaseRecord.detail_medis || {},
        riwayat_pendidikan: supabaseRecord.riwayat_pendidikan || [],
        link_url_drive: supabaseRecord.link_url_drive || {},
        verifikasi_status: supabaseRecord.verifikasi_status,
        verifikasi_catatan: supabaseRecord.verifikasi_catatan
    };
}

/**
 * AUTO-DETECT SUB1: MEDIS atau NON-MEDIS
 * Berdasarkan keyword di jabatan
 */
function determineSub1(jabatan) {
    if (!jabatan) return "NON-MEDIS";
    const keywords = PEGAWAI_KATEGORISASI.MEDIS_KEYWORDS;
    const isMedis = keywords.some(kw =>
        jabatan.toLowerCase().includes(kw.toLowerCase())
    );
    return isMedis ? "MEDIS" : "NON-MEDIS";
}

/**
 * AUTO-DETECT SUB2: STRUKTURAL atau FUNGSIONAL
 * Berdasarkan keyword di jabatan
 */
function determineSub2(jabatan) {
    if (!jabatan) return "FUNGSIONAL";
    const keywords = PEGAWAI_KATEGORISASI.STRUKTURAL_KEYWORDS;
    const isStruktural = keywords.some(kw =>
        jabatan.toLowerCase().includes(kw.toLowerCase())
    );
    return isStruktural ? "STRUKTURAL" : "FUNGSIONAL";
}

/**
 * GET MAP COLOR PROPERTIES
 * Kembalikan seluruh style properties untuk warna map
 */
function getMapColorStyle(status_kepegawaian) {
    return STATUS_MAP_COLOR[status_kepegawaian] || STATUS_MAP_COLOR["Honorer"];
}

/**
 * GET MAP BADGE HTML
 * Generate HTML badge untuk display di dashboard
 */
function getMapBadgeHTML(status_kepegawaian) {
    const style = getMapColorStyle(status_kepegawaian);
    return `
        <div class="px-2.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 
                    bg-${style.bgColor} text-${style.textColor} border border-${style.borderColor}">
            <i class="fa-solid ${style.icon} text-xs"></i>
            <span>MAP ${style.color}</span>
        </div>
    `;
}

// ============================================================
// 6. VALIDASI DATA
// ============================================================

/**
 * Validasi field required sebelum submit
 */
function validatePegawaiForm(formData) {
    const errors = [];

    if (!formData.nip?.trim()) errors.push("NIP/SK Kedinasan wajib diisi");
    if (!formData.nama?.trim()) errors.push("Nama Lengkap wajib diisi");
    if (!formData.status_kepegawaian?.trim()) errors.push("Status Kepegawaian wajib dipilih");
    if (!formData.ruangan?.trim()) errors.push("Unit Kerja Penempatan wajib dipilih");

    if (formData.detail_personal?.nik && formData.detail_personal.nik.length !== 16) {
        errors.push("NIK harus 16 digit");
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

// ============================================================
// 7. MAPPING UNTUK DISPLAY DI umpeg.html
// ============================================================

/**
 * Get Badge Status Verifikasi
 * Untuk tabel verifikasi di umpeg.html
 */
function getVerifikasiStatusBadge(status) {
    const statusMap = {
        "PENDING": {
            label: "🟡 MENUNGGU AUDIT",
            bgColor: "bg-amber-100",
            textColor: "text-amber-900",
            borderColor: "border-amber-300"
        },
        "TERVERIFIKASI": {
            label: "🟢 TERVERIFIKASI",
            bgColor: "bg-emerald-100",
            textColor: "text-emerald-900",
            borderColor: "border-emerald-300"
        },
        "PERLU_PERBAIKAN": {
            label: "🔴 PERLU PERBAIKAN",
            bgColor: "bg-rose-100",
            textColor: "text-rose-900",
            borderColor: "border-rose-300"
        }
    };

    return statusMap[status] || statusMap["PENDING"];
}

/**
 * Format display untuk tabel admin
 */
function formatPegawaiForTable(pegawai) {
    return {
        id_unik: pegawai.id_pegawai,
        nama: pegawai.nama,
        nip: pegawai.nip,
        status: pegawai.status_kepegawaian,
        map_color: pegawai.map_status,
        jabatan: pegawai.jabatan,
        ruangan: pegawai.ruangan,
        sub1: pegawai.sub1,
        sub2: pegawai.sub2,
        verifikasi_status: pegawai.verifikasi_status,
        verifikasi_catatan: pegawai.verifikasi_catatan,
        link_count: Object.keys(pegawai.link_url_drive || {}).length
    };
}

// ============================================================
// 8. EXPORT (untuk penggunaan di file HTML lain)
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Mapping
        STATUS_MAP_COLOR,
        PEGAWAI_KATEGORISASI,

        // Transform
        transformFormToSupabase,
        transformSupabaseToForm,
        determineSub1,
        determineSub2,
        getMapColorStyle,
        getMapBadgeHTML,
        getVerifikasiStatusBadge,

        // Validasi
        validatePegawaiForm,
        formatPegawaiForTable,

        // Template
        PEGAWAI_UNIFIED_STRUCTURE
    };
}
