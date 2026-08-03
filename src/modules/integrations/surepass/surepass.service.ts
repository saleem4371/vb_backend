import { Injectable, BadRequestException , Logger} from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { IntegrationService } from '../integSettings/integSettings.service';

import { DataSource } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

@Injectable()
export class SurepassService {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly http: HttpService,
    private dataSource: DataSource,
    private storageService: StorageService,
    
  ) {}

   private readonly logger = new Logger(SurepassService.name);

  //   async verifyPan(pan: string) {
//   async verifyPan(body: any, id: any,category: any,country: any) {
//     const config =
//       await this.integrationService.getIntegrationConfig('surepass');
//     const [existingPan] = await this.dataSource.query(
//       `SELECT id FROM user_kyc_documents WHERE document_number = ? LIMIT 1`,
//       [body.pan],
//     );

//       const singular = category.endsWith("s")
//     ? category.slice(0, -1)
//     : category;

//   const [categoryData] = await this.dataSource.query(
//     `SELECT * FROM category WHERE name = ?`,
//     [singular],
//   );

//     if (existingPan) {
//       const [dbRow] = await this.dataSource.query(
//         `SELECT *
//      FROM user_kyc_documents
//      WHERE user_id = ? AND document_type = 'pan'
//      ORDER BY id DESC
//      LIMIT 1`,
//         [id],
//       );

//       const details = JSON.parse(dbRow.doc_details || '{}');

//       return {
//         company_name: details.full_name || '', // PAN holder name
//         pan_number: dbRow.document_number || '', // stored PAN number
//         business_category: details.category || 'person', // person/company type
//         registered_address:
//           details.address?.full || // full address
//           [details.address?.city, details.address?.state, details.address?.zip]
//             .filter(Boolean)
//             .join(', ') ||
//           '',
//       };
//     }

//     const configData = typeof config === 'string' ? JSON.parse(config) : config;

//     try {
//         const response = await this.http.axiosRef.post(
//           `${configData.base_url}/api/v1/pan/pan-comprehensive`,
//           {
//             id_number: body.pan,
//             get_address: true
//           },
//           {
//             headers: {
//               Authorization: `Bearer ${configData.api_key}`,
//               'Content-Type': 'application/json',
//             },
//           },
//         );

//        const panData = response.data.data;

//       // const panData = '';

//       await this.dataSource.query(
//         `
//   INSERT INTO user_kyc_documents
//   (category_id,
//       country_id,user_id, document_type, document_number, file_url, verification_status, doc_details, verified_by, verified_at, created_at)
//   VALUES (?,?,?, ?, ?, ?, ?, ?, ?, ?, NOW())
//   `,
//         [
//           categoryData.id,
//           country,
//           id,
//           'pan',
//           body.pan,
//           '',
//           'pending',
//           JSON.stringify(panData), // if JSON column
//           0,
//           null,
//         ],
//       );

//       const [dbRow] = await this.dataSource.query(
//         `SELECT *
//      FROM user_kyc_documents
//      WHERE user_id = ? AND document_type = 'pan'
//      ORDER BY id DESC
//      LIMIT 1`,
//         [id],
//       );

//       if (body.category === "business") {
//   const response = await this.http.axiosRef.post(
//     `${configData.base_url}/api/v1/corporate/gstin-by-pan`,
//     {
//       id_number: body.pan,
//     },
//     {
//       headers: {
//         Authorization: `Bearer ${configData.api_key}`,
//         "Content-Type": "application/json",
//       },
//     },
//   );

//   const gstData = response.data.data;

//   if (!gstData) {
//     throw new BadRequestException("GST details not found");
//   }

//   await this.dataSource.query(
//     `
//     INSERT INTO user_kyc_documents
//     (
//       user_id,
//       category_id,
//       country_id,
//       document_type,
//       document_number,
//       verification_status,
//       doc_details,
//       created_at
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
//     `,
//     [
//       body.user_id,
//       body.category_id,
//       body.country_id,
//       "gstin",
//       gstData.gstin || null,
//       "approved",
//       JSON.stringify(gstData),
//     ],
//   );

// }
   

//       const details = JSON.parse(dbRow.doc_details || '{}');

//       return {
//         company_name: details.full_name || '', // PAN holder name
//         pan_number: dbRow.document_number || '', // stored PAN number
//         business_category: details.category || 'person', // person/company type
//         registered_address:
//           details.address?.full || // full address
//           [details.address?.city, details.address?.state, details.address?.zip]
//             .filter(Boolean)
//             .join(', ') ||
//           '',
//       };
//     } catch (error: any) {
//       console.log('Status:', error?.response?.status);
//       console.log('Data:', error?.response?.data);
//       console.log('Headers:', error?.response?.headers);

//       // throw error;
//     }


//   }
// async verifyPan(body: any, id: any, category: any, country: any) {
//   const config = await this.integrationService.getIntegrationConfig("surepass");
//   const configData =
//     typeof config === "string" ? JSON.parse(config) : config;

//   const singular = category.endsWith("s")
//     ? category.slice(0, -1)
//     : category;

//   const [categoryData] = await this.dataSource.query(
//     `SELECT * FROM category WHERE name = ? LIMIT 1`,
//     [singular],
//   );

//   // Check existing PAN for this user
//   const [existingPan] = await this.dataSource.query(
//     `
//     SELECT *
//     FROM user_kyc_documents
//     WHERE user_id = ?
//       AND document_type = 'pan'
//     LIMIT 1
//     `,
//     [id],
//   );

//   if (existingPan) {
//     const details = JSON.parse(existingPan.doc_details || "{}");

//     const [gstRow] = await this.dataSource.query(
//   `
//   SELECT *
//   FROM user_kyc_documents
//   WHERE user_id = ?
//     AND document_type = 'gst'
//   ORDER BY id DESC
//   LIMIT 1
//   `,
//   [id],
// );

// const gstDetails = gstRow
//   ? JSON.parse(gstRow.doc_details || "{}")
//   : null;

//     return {
//       company_name: details.full_name || "",
//       pan_number: existingPan.document_number || "",
//       business_category: details.category || "person",
//       gst_number: gstRow?.document_number || "",
//   gst_details: gstDetails,
//       registered_address:
//         details.address?.full ||
//         [
//           details.address?.city,
//           details.address?.state,
//           details.address?.zip,
//         ]
//           .filter(Boolean)
//           .join(", "),
//     };
//   }

//   try {
//     // PAN Verification
//     const panResponse = await this.http.axiosRef.post(
//       `${configData.base_url}/api/v1/pan/pan-comprehensive`,
//       {
//         id_number: body.pan,
//         get_address: true,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${configData.api_key}`,
//           "Content-Type": "application/json",
//         },
//       },
//     );

//     const panData = panResponse.data.data;

//     await this.dataSource.query(
//       `
//       INSERT INTO user_kyc_documents
//       (
//         category_id,
//         country_id,
//         user_id,
//         document_type,
//         document_number,
//         file_url,
//         verification_status,
//         doc_details,
//         verified_by,
//         verified_at,
//         created_at
//       )
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//       `,
//       [
//         categoryData.id,
//         country,
//         id,
//         "pan",
//         body.pan,
//         "",
//         "pending",
//         JSON.stringify(panData),
//         0,
//         null,
//       ],
//     );

//     // Business GST Verification
//     if (body.category === "business") {
//       const gstResponse = await this.http.axiosRef.post(
//         `${configData.base_url}/api/v1/corporate/gstin-by-pan`,
//         {
//           id_number: body.pan,
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${configData.api_key}`,
//             "Content-Type": "application/json",
//           },
//         },
//       );

//       const gstData = gstResponse.data?.data;

//       if (gstData) {

//         const gstin = gstData?.gstin_list?.[0]?.gstin;
//         const [existingGST] = await this.dataSource.query(
//           `
//           SELECT id
//           FROM user_kyc_documents
//           WHERE user_id = ?
//             AND document_type = 'gstin'
//           LIMIT 1
//           `,
//           [id],
//         );

//         if (existingGST) {
//           await this.dataSource.query(
//             `
//             UPDATE user_kyc_documents
//             SET
//               document_number = ?,
//               verification_status = 'approved',
//               doc_details = ?,
//               verified_at = NOW()
//             WHERE id = ?
//             `,
//             [
//               gstin,
//               JSON.stringify(gstData),
//               existingGST.id,
//             ],
//           );
//         } else {
//           await this.dataSource.query(
//             `
//             INSERT INTO user_kyc_documents
//             (
//               category_id,
//               country_id,
//               user_id,
//               document_type,
//               document_number,
//               verification_status,
//               doc_details,
//               created_at
//             )
//             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
//             `,
//             [
//               categoryData.id,
//               country,
//               id,
//               "gst",
//               gstin,
//               "approved",
//               JSON.stringify(gstData),
//             ],
//           );
//         }
//       }
//     }

//     const [dbRow] = await this.dataSource.query(
//       `
//       SELECT *
//       FROM user_kyc_documents
//       WHERE user_id = ?
//         AND document_type = 'pan'
//       ORDER BY id DESC
//       LIMIT 1
//       `,
//       [id],
//     );

//     const details = JSON.parse(dbRow.doc_details || "{}");

//     const [gstRow] = await this.dataSource.query(
//   `
//   SELECT *
//   FROM user_kyc_documents
//   WHERE user_id = ?
//     AND document_type = 'gst'
//   ORDER BY id DESC
//   LIMIT 1
//   `,
//   [id],
// );

// const gstDetails = gstRow
//   ? JSON.parse(gstRow.doc_details || "{}")
//   : null;

//     return {
//       company_name: details.full_name || "",
//       pan_number: dbRow.document_number || "",
//       business_category: details.category || "person",
//        gst_number: gstRow?.document_number || "",
//   gst_details: gstDetails,
//       registered_address:
//         details.address?.full ||
//         [
//           details.address?.city,
//           details.address?.state,
//           details.address?.zip,
//         ]
//           .filter(Boolean)
//           .join(", "),
//     };
//   } catch (error: any) {
//     console.log("Status:", error?.response?.status);
//     console.log("Data:", error?.response?.data);

//     throw new BadRequestException(
//       error?.response?.data?.message || "PAN verification failed",
//     );
//   }
// }
async verifyPan(body: any, id: any, category: any, country: any) {
  const config = await this.integrationService.getIntegrationConfig("surepass");
  const configData =
    typeof config === "string" ? JSON.parse(config) : config;

  const singular = category.endsWith("s")
    ? category.slice(0, -1)
    : category;

  const [categoryData] = await this.dataSource.query(
    `SELECT * FROM category WHERE name = ? LIMIT 1`,
    [singular],
  );

  try {
    // PAN Verification
   // Check if PAN already exists
// Check if this PAN already exists for this user
const [existingPan] = await this.dataSource.query(
  `
  SELECT *
  FROM user_kyc_documents
  WHERE document_type = 'pan'
    AND document_number = ?
  ORDER BY id DESC
  LIMIT 1
  `,
  [body.pan],
);

let panData: any;

// If PAN exists for this user, use stored data
if (existingPan) {
  panData = JSON.parse(existingPan.doc_details || "{}");
} else {
  // Call Surepass only if PAN is not already stored for this user
  const panResponse = await this.http.axiosRef.post(
    `${configData.base_url}/api/v1/pan/pan-comprehensive`,
    {
      id_number: body.pan,
      get_address: true,
    },
    {
      headers: {
        Authorization: `Bearer ${configData.api_key}`,
        "Content-Type": "application/json",
      },
    },
  );

  panData = panResponse.data.data;
}

// ALWAYS INSERT (new auto-increment ID)
await this.dataSource.query(
  `
  INSERT INTO user_kyc_documents
  (
    category_id,
    country_id,
    user_id,
    document_type,
    document_number,
    file_url,
    verification_status,
    doc_details,
    verified_by,
    verified_at,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `,
  [
    categoryData.id,
    country,
    id,
    "pan",
    body.pan,
    "",
    "pending",
    JSON.stringify(panData),
    0,
    null,
  ],
);

// ------------------------------------------------------------------
// PAN NOT FOUND -> CALL SUREPASS API
// ------------------------------------------------------------------



    // GST Verification (Business Only)
  // GST Verification (Business Only)
if (body.category === "business") {
  let gstData: any = null;
  let gstin = "";

  // Check if GST already exists for this user
  const [existingGST] = await this.dataSource.query(
    `
    SELECT *
    FROM user_kyc_documents
    WHERE  document_type = 'gst' AND user_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [existingPan.user_id],
  );

  if (existingGST) {
    // Use existing GST data
    gstData = JSON.parse(existingGST.doc_details || "{}");
    gstin = existingGST.document_number;
  } else {
    // Call Surepass GST API
    const gstResponse = await this.http.axiosRef.post(
      `${configData.base_url}/api/v1/corporate/gstin-by-pan`,
      {
        id_number: body.pan,
      },
      {
        headers: {
          Authorization: `Bearer ${configData.api_key}`,
          "Content-Type": "application/json",
        },
      },
    );

    gstData = gstResponse.data?.data;
    gstin = gstData?.gstin_list?.[0]?.gstin || "";
  }

  // Always INSERT a new GST record
  if (gstData) {
    await this.dataSource.query(
      `
      INSERT INTO user_kyc_documents
      (
        category_id,
        country_id,
        user_id,
        document_type,
        document_number,
        file_url,
        verification_status,
        doc_details,
        verified_by,
        verified_at,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        categoryData.id,
        country,
        id,
        "gst",
        gstin,
        "",
        "approved",
        JSON.stringify(gstData),
        0,
        null,
      ],
    );
  }
}

    // Fetch latest PAN
    const [dbRow] = await this.dataSource.query(
      `
      SELECT *
      FROM user_kyc_documents
      WHERE user_id = ?
        AND document_type = 'pan'
      ORDER BY id DESC
      LIMIT 1
      `,
      [id],
    );

    const details = JSON.parse(dbRow.doc_details || "{}");

    // Fetch latest GST
    const [gstRow] = await this.dataSource.query(
      `
      SELECT *
      FROM user_kyc_documents
      WHERE user_id = ?
        AND document_type = 'gst'
      ORDER BY id DESC
      LIMIT 1
      `,
      [id],
    );

    const gstDetails = gstRow
      ? JSON.parse(gstRow.doc_details || "{}")
      : null;

    return {
      company_name: details.full_name || "",
      pan_number: dbRow.document_number || "",
      business_category: details.category || "person",
      gst_number: gstRow?.document_number || "",
      gst_details: gstDetails,
      registered_address:
        details.address?.full ||
        [
          details.address?.city,
          details.address?.state,
          details.address?.zip,
        ]
          .filter(Boolean)
          .join(", "),
    };
  } catch (error: any) {
    console.log("Status:", error?.response?.status);
    console.log("Data:", error?.response?.data);

    throw new BadRequestException(
      error?.response?.data?.message || "PAN verification failed",
    );
  }
}

  // async verifyBank(body: any) {
  //   const config =
  //     await this.integrationService.getIntegrationConfig('surepass');

  //   const [existingBank] = await this.dataSource.query(
  //     `SELECT id FROM user_kyc_documents WHERE document_number = ? LIMIT 1`,
  //     [body.acct],
  //   );

  //   if (existingBank) {
  //     return false;
  //     //user_kyc_bank_details
  //   }
  //   const configData = typeof config === 'string' ? JSON.parse(config) : config;

  //   return this.http.axiosRef.post(
  //     `${configData.base_url}/api/v1/bank-verification/pennyless`,
  //     {
  //       id_number: body.acct,
  //       ifsc: body.acct,
  //       ifsc_details: true,
  //     },
  //     {
  //       headers: {
  //         Authorization: `Bearer ${configData.api_key}`,
  //       },
  //     },
  //   );
  //   //user_kyc_bank_details
  // }


  // async verifyBank(body: any, id: any,category: any,country: any) {

  //    const singular = category.endsWith("s")
  //   ? category.slice(0, -1)
  //   : category;

  // const [categoryData] = await this.dataSource.query(
  //   `SELECT * FROM category WHERE name = ?`,
  //   [singular],
  // );

  //   const config =
  //     await this.integrationService.getIntegrationConfig('surepass');

  //   const [existingBank] = await this.dataSource.query(
  //     `SELECT * FROM user_kyc_bank_details
  //    WHERE account_number = ?
  //    LIMIT 1`,
  //     [body.acct],
  //   );

  //   if (existingBank) {
  //     return existingBank;
  //   }

  //   const configData = typeof config === 'string' ? JSON.parse(config) : config;

  //   try {
  //     const response = await this.http.axiosRef.post(
  //       `${configData.base_url}/api/v1/bank-verification/pennyless`,
  //       {
  //         id_number: body.acct,
  //         ifsc: body.cleanIFSC,
  //         ifsc_details: true,
  //       },
  //       {
  //         headers: {
  //           Authorization: `Bearer ${configData.api_key}`,
  //         },
  //       },
  //     );

  //     const apiData = response.data?.data;

  //     await this.dataSource.query(
  //       `
  //     INSERT INTO user_kyc_bank_details
  //     (
  //       category_id,
  //       country_id,
  //       user_id,
  //       bank_name,
  //       account_number,
  //       ifsc,
  //       account_type,
  //       business_name,
  //       branch_name,
  //       business_type,
  //       created_at,
  //       updated_at
  //     )
  //     VALUES
  //     (
  //       ?,?,?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
  //     )
  //     `,
  //       [
  //         categoryData.id,
  //         country,
  //         id,
  //         apiData?.ifsc_details?.bank_name || null,
  //         apiData?.account_number || body.acct,
  //         apiData?.ifsc_details?.ifsc || body.cleanIFSC,
  //         body.accountType || 'SAVINGS',
  //         apiData?.full_name || null,
  //         apiData?.ifsc_details?.branch || null,
  //         body.businessType || null,
  //       ],
  //     );

  //      const [Banks] = await this.dataSource.query(
  //     `SELECT * FROM user_kyc_bank_details
  //    WHERE account_number = ?
  //    LIMIT 1`,
  //     [body.acct],
  //   );

  //     return Banks;
  //   } catch (error) {
  //     console.error('Bank Verification Error:');

  //     throw new Error('Bank verification failed');
  //   }
  // }

  async verifyBank(body: any, id: any, category: any, country: any) {
  const singular = category.endsWith("s")
    ? category.slice(0, -1)
    : category;

  const [categoryData] = await this.dataSource.query(
    `SELECT * FROM category WHERE name = ? LIMIT 1`,
    [singular],
  );

  const config = await this.integrationService.getIntegrationConfig("surepass");
  const configData =
    typeof config === "string" ? JSON.parse(config) : config;

  let bankData: any;

  // Check if same account already exists for this user
  const [existingBank] = await this.dataSource.query(
    `
    SELECT *
    FROM user_kyc_bank_details
    WHERE account_number = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [body.acct],
  );

  if (existingBank) {
    // Use existing data
    bankData = existingBank;
  } else {
    // Call Surepass API
    try {
      const response = await this.http.axiosRef.post(
        `${configData.base_url}/api/v1/bank-verification/pennyless`,
        {
          id_number: body.acct,
          ifsc: body.cleanIFSC,
          ifsc_details: true,
        },
        {
          headers: {
            Authorization: `Bearer ${configData.api_key}`,
          },
        },
      );

      bankData = response.data?.data;
    } catch (error) {
      console.error("Bank Verification Error:");

      throw new Error("Bank verification failed");
    }
  }

  // Always INSERT a new record
  await this.dataSource.query(
    `
    INSERT INTO user_kyc_bank_details
    (
      category_id,
      country_id,
      user_id,
      bank_name,
      account_number,
      ifsc,
      account_type,
      business_name,
      branch_name,
      business_type,
      created_at,
      updated_at
    )
    VALUES
    (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
    )
    `,
    [
      categoryData.id,
      country,
      id,
      existingBank
        ? existingBank.bank_name
        : bankData?.ifsc_details?.bank_name || null,
      existingBank
        ? existingBank.account_number
        : bankData?.account_number || body.acct,
      existingBank
        ? existingBank.ifsc
        : bankData?.ifsc_details?.ifsc || body.cleanIFSC,
      body.accountType || existingBank?.account_type || "SAVINGS",
      existingBank
        ? existingBank.business_name
        : bankData?.full_name || null,
      existingBank
        ? existingBank.branch_name
        : bankData?.ifsc_details?.branch || null,
      body.businessType || existingBank?.business_type || null,
    ],
  );

  // Return latest inserted record
  const [bank] = await this.dataSource.query(
    `
    SELECT *
    FROM user_kyc_bank_details
    WHERE user_id = ?
      AND account_number = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [id, body.acct],
  );

  return bank;
}

  // ============================================================
  // ✅ AADHAAR / DIGILOCKER (FIXED)
  // ============================================================
  //
  // Bugs fixed here:
  //  1. `verifyAdhar` never received `id`/`category`/`country`, so there was
  //     no way to know which user a DigiLocker session belonged to once
  //     Surepass redirected/webhooked back.
  //  2. `handleCallback` referenced `axios.get(...)` but `axios` was never
  //     imported anywhere in this file — that line would throw
  //     `ReferenceError: axios is not defined` the moment status === 'success'.
  //  3. `handleCallback` read `body.user_id`, but the method's only parameter
  //     is `query` — `body` doesn't exist in that scope, so this was always
  //     `undefined` (or a ReferenceError under strict settings), and every
  //     inserted Aadhaar row would have `user_id = null`.
  //  4. `handleCallback` hardcoded `category_id: 0, country_id: 2` instead of
  //     resolving them per-request like every other verify method does.
  //  5. `handleCallback` used `process.env.SUREPASS_API_KEY` instead of the
  //     integration config the rest of the service uses — inconsistent and
  //     silently broken if that env var was never set.
  //
  // Fix: encode {id, category, country} into a `state` value when we call
  // /digilocker/initialize. Surepass echoes `state` back on both the
  // browser redirect (query.state) and the server-to-server webhook
  // (body.state), so we can always recover which user/category/country a
  // given callback belongs to — no separate mapping table needed.
  // ============================================================

  async verifyAdhar(body: any, id: any, category: any, country: any) {
    const config =
      await this.integrationService.getIntegrationConfig('surepass');

    const configData = typeof config === 'string' ? JSON.parse(config) : config;

    // Carries the requesting user's context through DigiLocker's redirect
    // and webhook round-trip. Base64 keeps it URL-safe.
    const state = Buffer.from(
      JSON.stringify({ id, category, country }),
    ).toString('base64');

    try {
      const { data } = await this.http.axiosRef.post(
        `${configData.base_url}/api/v1/digilocker/initialize`,
        {
          data: {
            signup_flow: true,
            logo_url:
              'https://venuebook-psi.vercel.app/_next/static/media/logo.0e72csmjxihn9.svg',
            redirect_url: `${process.env.FILE_URL}/thirdParty/digilocker/callback`,
            webhook_url: `${process.env.FILE_URL}/thirdParty/digilocker/webhook`,
            skip_main_screen: false,
            aadhaar_xml: true,
            state,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${configData.api_key}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return data;
    } catch (error) {
      throw error;
    }
  }

  async callback(body: any) {
    console.log(body);
  }

  async UploadDocument(document: any, body: any, userId: number) {
    let imagePath = '';

    if (document) {
      imagePath = await this.storageService.upload(
        document,
        'Documents/images',
      );
    }

    await this.dataSource.query(
      `
    UPDATE user_kyc_documents
    SET
      document_number = ?,
      file_url = ?,
      verification_status = 'pending'
    WHERE user_id = ?
      AND document_type = 'pan'
    `,
      [body.expected_pan, imagePath, userId],
    );

    return {
      success: true,
      expected_pan: body.expected_pan,
      imagePath,
    };
  }

  async verifyGST(body: any, userId: number) {
    return true;
  }

  /**
   * Decodes the `state` value we set during /digilocker/initialize.
   * Returns null if it's missing or unparsable (e.g. an old/expired link).
   */
  private decodeDigilockerState(
    raw: string | undefined,
  ): { id: any; category: any; country: any } | null {
    if (!raw) return null;
    try {
      const decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      return decoded?.id ? decoded : null;
    } catch {
      return null;
    }
  }

  //Digilocker
  async handleCallback(query: any) {
    try {
      this.logger.log('===== DigiLocker Callback =====');
      this.logger.log(JSON.stringify(query, null, 2));

      if (query.status !== 'success') {
        return { success: false };
      }

      const context = this.decodeDigilockerState(query.state);

      if (!context) {
        this.logger.error(
          'DigiLocker callback missing/invalid state — cannot map to a user',
        );
        return { success: false };
      }

      const singular = context.category?.endsWith('s')
        ? context.category.slice(0, -1)
        : context.category;

      const [categoryData] = await this.dataSource.query(
        `SELECT * FROM category WHERE name = ? LIMIT 1`,
        [singular],
      );

      const config =
        await this.integrationService.getIntegrationConfig('surepass');
      const configData =
        typeof config === 'string' ? JSON.parse(config) : config;

      // Download Aadhaar using client_id
      const aadhaarResponse = await this.http.axiosRef.get(
        `${configData.base_url}/api/v1/digilocker/download-aadhaar/${query.client_id}`,
        {
          headers: {
            Authorization: `Bearer ${configData.api_key}`,
          },
        },
      );

      const aadhaar = aadhaarResponse.data;

      await this.dataSource.query(
        `
        INSERT INTO user_kyc_documents
        (
          category_id,
          country_id,
          user_id,
          document_type,
          document_number,
          doc_details,
          verification_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          categoryData?.id ?? null,
          context.country,
          context.id,
          'aadhaar',
          aadhaar.data?.aadhaar_number ?? null,
          JSON.stringify(aadhaar),
          'approved',
        ],
      );

      return {
        success: true,
        aadhaar,
      };
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Handles Surepass webhook
   */
  async handleWebhook(body: any, category: any, country: any) {
    try {
      this.logger.log('===== DigiLocker Webhook =====');
      this.logger.log(JSON.stringify(body, null, 2));

      // Prefer the state we set during initialize (Surepass echoes it back
      // on the webhook body too), falling back to whatever the controller
      // route passed in so this still works if state is ever missing.
      const context = this.decodeDigilockerState(body.state ?? body.data?.state);

      const userId = context?.id ?? body.user_id;
      const effectiveCategory = context?.category ?? category;
      const effectiveCountry = context?.country ?? country;

      if (!userId) {
        this.logger.error(
          'DigiLocker webhook missing user context — cannot store result',
        );
        return { success: false };
      }

      const singular = effectiveCategory?.endsWith('s')
        ? effectiveCategory.slice(0, -1)
        : effectiveCategory;

      const [categoryData] = await this.dataSource.query(
        `SELECT * FROM category WHERE name = ? LIMIT 1`,
        [singular],
      );

      if (body.status === 'success') {
        await this.dataSource.query(
          `
          INSERT INTO user_kyc_documents
          (
            category_id,
            country_id,
            user_id,
            document_type,
            document_number,
            doc_details,
            verification_status
          )
          VALUES (?,?,?, ?, ?, ?, ?)
          `,
          [
            categoryData?.id ?? null,
            effectiveCountry,
            userId,
            'aadhaar',
            body.aadhaar_number,
            JSON.stringify(body),
            'approved',
          ],
        );
      }

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }
}
