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

  // Check existing PAN for this user
  const [existingPan] = await this.dataSource.query(
    `
    SELECT *
    FROM user_kyc_documents
    WHERE user_id = ?
      AND document_type = 'pan'
    LIMIT 1
    `,
    [id],
  );

  if (existingPan) {
    const details = JSON.parse(existingPan.doc_details || "{}");

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
      pan_number: existingPan.document_number || "",
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
  }

  try {
    // PAN Verification
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

    const panData = panResponse.data.data;

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

    // Business GST Verification
    if (body.category === "business") {
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

      const gstData = gstResponse.data?.data;

      if (gstData) {

        const gstin = gstData?.gstin_list?.[0]?.gstin;
        const [existingGST] = await this.dataSource.query(
          `
          SELECT id
          FROM user_kyc_documents
          WHERE user_id = ?
            AND document_type = 'gstin'
          LIMIT 1
          `,
          [id],
        );

        if (existingGST) {
          await this.dataSource.query(
            `
            UPDATE user_kyc_documents
            SET
              document_number = ?,
              verification_status = 'approved',
              doc_details = ?,
              verified_at = NOW()
            WHERE id = ?
            `,
            [
              gstin,
              JSON.stringify(gstData),
              existingGST.id,
            ],
          );
        } else {
          await this.dataSource.query(
            `
            INSERT INTO user_kyc_documents
            (
              category_id,
              country_id,
              user_id,
              document_type,
              document_number,
              verification_status,
              doc_details,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `,
            [
              categoryData.id,
              country,
              id,
              "gst",
              gstin,
              "approved",
              JSON.stringify(gstData),
            ],
          );
        }
      }
    }

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


  async verifyBank(body: any, id: any,category: any,country: any) {

     const singular = category.endsWith("s")
    ? category.slice(0, -1)
    : category;

  const [categoryData] = await this.dataSource.query(
    `SELECT * FROM category WHERE name = ?`,
    [singular],
  );

    const config =
      await this.integrationService.getIntegrationConfig('surepass');

    const [existingBank] = await this.dataSource.query(
      `SELECT * FROM user_kyc_bank_details
     WHERE account_number = ?
     LIMIT 1`,
      [body.acct],
    );

    if (existingBank) {
      return existingBank;
    }

    const configData = typeof config === 'string' ? JSON.parse(config) : config;

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

      const apiData = response.data?.data;

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
        ?,?,?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
      `,
        [
          categoryData.id,
          country,
          id,
          apiData?.ifsc_details?.bank_name || null,
          apiData?.account_number || body.acct,
          apiData?.ifsc_details?.ifsc || body.cleanIFSC,
          body.accountType || 'SAVINGS',
          apiData?.full_name || null,
          apiData?.ifsc_details?.branch || null,
          body.businessType || null,
        ],
      );

       const [Banks] = await this.dataSource.query(
      `SELECT * FROM user_kyc_bank_details
     WHERE account_number = ?
     LIMIT 1`,
      [body.acct],
    );

      return Banks;
    } catch (error) {
      console.error('Bank Verification Error:');

      throw new Error('Bank verification failed');
    }
  }

  async verifyAdhar(body: any) {
    const config =
      await this.integrationService.getIntegrationConfig('surepass');

    // const [existingPan] = await this.dataSource.query(
    //   `SELECT id FROM user_kyc_documents WHERE document_number = ? LIMIT 1`,
    //   [body.aadhaarNumber]
    // );

    // if (existingPan) {
    //   return false;
    // }

    // curl --location 'https://kyc-api.surepass.app/api/v1/digilocker/initialize' \
    // --header 'Authorization: Bearer <token>' \
    // --header 'Content-Type: application/json' \
    // --data '{
    //     "data": {
    //         "signup_flow": true,
    //         "auth_type": "app"
    //     }
    // }'
    const configData = typeof config === 'string' ? JSON.parse(config) : config;

    try {
  const { data } = await this.http.axiosRef.post(
    `${configData.base_url}/api/v1/digilocker/initialize`,
    {
      data: {
        // signup_flow: true,
        // webhook_url: `${process.env.APP_URL}/thirdParty/digilocker/callback`,
        // state: `user_${Date.now()}`,
         "signup_flow": true,
        logo_url:'https://venuebook-psi.vercel.app/_next/static/media/logo.0e72csmjxihn9.svg',
redirect_url:`${process.env.APP_URL}/thirdParty/digilocker/callback`,
webhook_url: `${process.env.APP_URL}/thirdParty/digilocker/webhook`,
skip_main_screen:false,
aadhaar_xml:true
       
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

    // const { data } = await this.http.axiosRef.post(
    //   `${configData.base_url}/api/v1/digilocker/initialize`,
    //   {
    //     data: {
    //       signup_flow: true,
    //       webhook_url: `${process.env.APP_URL}/thirdParty/digilocker/callback`,
    //       state: `user_${Date.now()}`,
    //       //send_email: true,
    //     },
    //   },
    //   {
    //     headers: {
    //       Authorization: `Bearer ${configData.api_key}`,
    //       'Content-Type': 'application/json',
    //     },
    //   },
    // );

    

    // return data;
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

  //Digilocker
   async handleCallback(query: any) {
    try {
      this.logger.log('===== DigiLocker Callback =====');
      this.logger.log(JSON.stringify(query, null, 2));

      /**
       * Example query:
       * {
       *   request_id: "abc123",
       *   status: "success",
       *   state: "user_123",
       *   code: "xyz"
       * }
       */

      // TODO:
      // 1. Validate request
      // 2. Store request_id if required
      // 3. Fetch DigiLocker details if Surepass requires another API call

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Handles Surepass webhook
   */
  async handleWebhook(body: any,category: any,country: any) {
    try {
      this.logger.log('===== DigiLocker Webhook =====');
      this.logger.log(JSON.stringify(body, null, 2));

        const singular = category.endsWith("s")
    ? category.slice(0, -1)
    : category;

  const [categoryData] = await this.dataSource.query(
    `SELECT * FROM category WHERE name = ?`,
    [singular],
  );

      /**
       * Example payload:
       * {
       *   request_id: "...",
       *   status: "success",
       *   aadhaar_xml: "...",
       *   data: {...} //category,country
       * }
       */

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
      categoryData.id,
      country,
      body.user_id,
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
