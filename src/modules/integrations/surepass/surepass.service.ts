import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { IntegrationService } from '../integSettings/integSettings.service';
import { DataSource } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

interface AadhaarInitContext {
  userId: number;
  countryId: number;
  categoryId: number;
}

@Injectable()
export class SurepassService {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly http: HttpService,
    private dataSource: DataSource,
    private storageService: StorageService,
  ) {}

  private readonly logger = new Logger(SurepassService.name);

  async verifyPan(body: any, id: any, category: any, country: any) {
    const config = await this.integrationService.getIntegrationConfig('surepass');
    const configData = typeof config === 'string' ? JSON.parse(config) : config;

    const singular = category.endsWith('s') ? category.slice(0, -1) : category;

    const [categoryData] = await this.dataSource.query(
      `SELECT * FROM category WHERE name = ? LIMIT 1`,
      [singular],
    );

    try {
      /* FIX: this lookup previously matched on document_number alone,
         with no user_id filter — meaning if ANY user had already
         verified this exact PAN, every subsequent user entering the
         same PAN would silently receive that other user's cached PAN
         (and, further down, their GST) details instead of calling
         Surepass fresh. Scoping to user_id closes that cross-user
         data leak. */
      const [existingPan] = await this.dataSource.query(
        `
        SELECT *
        FROM user_kyc_documents
        WHERE document_type = 'pan'
          AND document_number = ?
          AND user_id = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [body.pan, id],
      );

      let panData: any;

      if (existingPan) {
        panData = JSON.parse(existingPan.doc_details || '{}');
      } else {
        const panResponse = await this.http.axiosRef.post(
          `${configData.base_url}/api/v1/pan/pan-comprehensive`,
          { id_number: body.pan, get_address: true },
          {
            headers: {
              Authorization: `Bearer ${configData.api_key}`,
              'Content-Type': 'application/json',
            },
          },
        );

        panData = panResponse.data.data;
      }

      await this.dataSource.query(
        `
        INSERT INTO user_kyc_documents
          (category_id, country_id, user_id, document_type, document_number,
           file_url, verification_status, doc_details, verified_by, verified_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `,
        [categoryData.id, country, id, 'pan', body.pan, '', 'pending', JSON.stringify(panData), 0, null],
      );

      // GST Verification (Business Only)
      if (body.category === 'business') {
        let gstData: any = null;
        let gstin = '';

        /* FIX: previously used `existingPan.user_id` here — when
           existingPan was null (a brand-new PAN, which is the common
           case), this threw "Cannot read properties of null" and the
           whole PAN+GST verification request crashed for every
           first-time business user. `id` (the current authenticated
           user) is what should have been used all along. */
        const [existingGST] = await this.dataSource.query(
          `
          SELECT *
          FROM user_kyc_documents
          WHERE document_type = 'gst' AND user_id = ?
          ORDER BY id DESC
          LIMIT 1
          `,
          [id],
        );

        if (existingGST) {
          gstData = JSON.parse(existingGST.doc_details || '{}');
          gstin = existingGST.document_number;
        } else {
          const gstResponse = await this.http.axiosRef.post(
            `${configData.base_url}/api/v1/corporate/gstin-by-pan`,
            { id_number: body.pan },
            {
              headers: {
                Authorization: `Bearer ${configData.api_key}`,
                'Content-Type': 'application/json',
              },
            },
          );

          gstData = gstResponse.data?.data;
          gstin = gstData?.gstin_list?.[0]?.gstin || '';
        }

        if (gstData) {
          await this.dataSource.query(
            `
            INSERT INTO user_kyc_documents
              (category_id, country_id, user_id, document_type, document_number,
               file_url, verification_status, doc_details, verified_by, verified_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `,
            [categoryData.id, country, id, 'gst', gstin, '', 'approved', JSON.stringify(gstData), 0, null],
          );
        }
      }

      const [dbRow] = await this.dataSource.query(
        `SELECT * FROM user_kyc_documents WHERE user_id = ? AND document_type = 'pan' ORDER BY id DESC LIMIT 1`,
        [id],
      );
      const details = JSON.parse(dbRow.doc_details || '{}');

      const [gstRow] = await this.dataSource.query(
        `SELECT * FROM user_kyc_documents WHERE user_id = ? AND document_type = 'gst' ORDER BY id DESC LIMIT 1`,
        [id],
      );
      const gstDetails = gstRow ? JSON.parse(gstRow.doc_details || '{}') : null;

      return {
        company_name: details.full_name || '',
        pan_number: dbRow.document_number || '',
        business_category: details.category || 'person',
        gst_number: gstRow?.document_number || '',
        gst_details: gstDetails,
        registered_address:
          details.address?.full ||
          [details.address?.city, details.address?.state, details.address?.zip].filter(Boolean).join(', '),
      };
    } catch (error: any) {
      console.log('Status:', error?.response?.status);
      console.log('Data:', error?.response?.data);

      throw new BadRequestException(error?.response?.data?.message || 'PAN verification failed');
    }
  }

  async verifyBank(body: any, id: any, category: any, country: any) {
    const singular = category.endsWith('s') ? category.slice(0, -1) : category;

    const [categoryData] = await this.dataSource.query(
      `SELECT * FROM category WHERE name = ? LIMIT 1`,
      [singular],
    );

    const config = await this.integrationService.getIntegrationConfig('surepass');
    const configData = typeof config === 'string' ? JSON.parse(config) : config;

    let bankData: any;

    const [existingBank] = await this.dataSource.query(
      `SELECT * FROM user_kyc_bank_details WHERE account_number = ? ORDER BY id DESC LIMIT 1`,
      [body.acct],
    );

    if (existingBank) {
      bankData = existingBank;
    } else {
      try {
        const response = await this.http.axiosRef.post(
          `${configData.base_url}/api/v1/bank-verification/pennyless`,
          { id_number: body.acct, ifsc: body.cleanIFSC, ifsc_details: true },
          { headers: { Authorization: `Bearer ${configData.api_key}` } },
        );

        bankData = response.data?.data;
      } catch (error) {
        console.error('Bank Verification Error:');
        throw new Error('Bank verification failed');
      }
    }

    await this.dataSource.query(
      `
      INSERT INTO user_kyc_bank_details
        (category_id, country_id, user_id, bank_name, account_number, ifsc,
         account_type, business_name, branch_name, business_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        categoryData.id,
        country,
        id,
        existingBank ? existingBank.bank_name : bankData?.ifsc_details?.bank_name || null,
        existingBank ? existingBank.account_number : bankData?.account_number || body.acct,
        existingBank ? existingBank.ifsc : bankData?.ifsc_details?.ifsc || body.cleanIFSC,
        body.accountType || existingBank?.account_type || 'SAVINGS',
        existingBank ? existingBank.business_name : bankData?.full_name || null,
        existingBank ? existingBank.branch_name : bankData?.ifsc_details?.branch || null,
        body.businessType || existingBank?.business_type || null,
      ],
    );

    const [bank] = await this.dataSource.query(
      `SELECT * FROM user_kyc_bank_details WHERE user_id = ? AND account_number = ? ORDER BY id DESC LIMIT 1`,
      [id, body.acct],
    );

    return bank;
  }

  /* ─────────────────────────────────────────────────────────────
     DigiLocker init.

     FIX: renamed from `verifyAdhar` (this doesn't verify Aadhaar —
     it kicks off the DigiLocker session; the actual Aadhaar data
     only lands in handleCallback/handleWebhook). More importantly,
     this now takes a single `ctx` object instead of positional
     (body, userId, countryId, categoryId) args. The old positional
     signature was the direct cause of the category/country swap bug:
     the controller's headers were named `categoryId`/`countryId` (in
     that order) but this function's params were `countryId`/
     `categoryId` (the OPPOSITE order) — so whichever value the
     controller passed third landed in the wrong parameter every time.
     An object with named keys can't be silently transposed like that.
  ───────────────────────────────────────────────────────────────── */
  // async initializeDigilocker(body: any, ctx: AadhaarInitContext) {
  //   const config = await this.integrationService.getIntegrationConfig('surepass');
  //   const configData = typeof config === 'string' ? JSON.parse(config) : config;

  //   const state = JSON.stringify({
  //     user_id: ctx.userId,
  //     country_id: ctx.countryId,
  //     category_id: ctx.categoryId,
  //   });

  //   try {
  //     const { data } = await this.http.axiosRef.post(
  //       `${configData.base_url}/api/v1/digilocker/initialize`,
  //       {
  //         data: {
  //           signup_flow: true,
  //           state,
  //           logo_url: 'https://venuebook-psi.vercel.app/_next/static/media/logo.0e72csmjxihn9.svg',
  //           redirect_url: `${process.env.APP_URL}/thirdParty/digilocker/callback`,
  //           webhook_url: `${process.env.APP_URL}/thirdParty/digilocker/webhook`,
  //           skip_main_screen: false,
  //           aadhaar_xml: true,
  //         },
  //       },
  //       {
  //         headers: {
  //           Authorization: `Bearer ${configData.api_key}`,
  //           'Content-Type': 'application/json',
  //         },
  //       },
  //     );

  //     return data;
  //   } catch (error) {
  //     throw error;
  //   }
  // }

  async initializeDigilocker(
  body: any,
  ctx: AadhaarInitContext,
) {
  const config =
    await this.integrationService.getIntegrationConfig(
      'surepass',
    );

  const configData =
    typeof config === 'string'
      ? JSON.parse(config)
      : config;

  const state = JSON.stringify({
    user_id: ctx.userId,
    country_id: ctx.countryId,
    category_id: ctx.categoryId,
  });

  const redirectUrl =
    `${process.env.APP_URL}/thirdParty/digilocker/callback`;

  const webhookUrl =
    `${process.env.APP_URL}/thirdParty/digilocker/webhook`;

  console.log('====================================');
  console.log('DIGILOCKER CONFIG');
  console.log('APP_URL:', process.env.APP_URL);
  console.log('REDIRECT URL:', redirectUrl);
  console.log('WEBHOOK URL:', webhookUrl);
  console.log('STATE:', state);
  console.log('====================================');

  try {
    const { data } =
      await this.http.axiosRef.post(
        `${configData.base_url}/api/v1/digilocker/initialize`,
        {
          data: {
            signup_flow: true,
            state,

            logo_url:
              'https://venuebook-psi.vercel.app/_next/static/media/logo.0e72csmjxihn9.svg',

            redirect_url: redirectUrl,

            webhook_url: webhookUrl,

            skip_main_screen: false,

            aadhaar_xml: true,
          },
        },
        {
          headers: {
            Authorization:
              `Bearer ${configData.api_key}`,

            'Content-Type':
              'application/json',
          },
        },
      );

    console.log(
      'SUREPASS INITIALIZE RESPONSE:',
      JSON.stringify(data, null, 2),
    );

    return data;
  } catch (error) {
    console.error(
      'SUREPASS INITIALIZE ERROR:',
      error?.response?.data ||
        error?.message ||
        error,
    );

    throw error;
  }
}

  async UploadDocument(document: any, body: any, userId: number) {
    let imagePath = '';

    if (document) {
      imagePath = await this.storageService.upload(document, 'Documents/images');
    }

    await this.dataSource.query(
      `
      UPDATE user_kyc_documents
      SET document_number = ?, file_url = ?, verification_status = 'pending'
      WHERE user_id = ? AND document_type = 'pan'
      `,
      [body.expected_pan, imagePath, userId],
    );

    return { success: true, expected_pan: body.expected_pan, imagePath };
  }

  async verifyGST(body: any, userId: number) {
    // Not yet implemented — PAN verification already bundles GST
    // lookup for business accounts (see verifyPan above). This
    // standalone endpoint is currently unused by the KYC wizard.
    return true;
  }

  /**
   * DigiLocker redirect callback — hit by the browser tab when
   * DigiLocker finishes, via GET /thirdParty/digilocker/callback.
   */
  async handleCallback(query: any) {
    try {
      this.logger.log('===== DigiLocker Callback =====');
      this.logger.log(JSON.stringify(query, null, 2));

      if (query.status !== 'success') {
        this.logger.warn(`DigiLocker status: ${query.status}`);
        return { success: false, message: 'DigiLocker verification failed' };
      }

      if (!query.client_id) {
        throw new Error('client_id is missing');
      }

      let state: any = {};
      if (query.state) {
        try {
          state = typeof query.state === 'string' ? JSON.parse(query.state) : query.state;
        } catch {
          throw new Error('Invalid state JSON');
        }
      }

      this.logger.log('===== Parsed State =====');
      this.logger.log(JSON.stringify(state, null, 2));

      const userId = Number(state.user_id);
      if (!userId) throw new Error(`Invalid user_id: ${state.user_id}`);

      const countryId = Number(state.country_id);
      if (!countryId) throw new Error(`Invalid country_id: ${state.country_id}`);

      const categoryId = Number(state.category_id);
      if (!categoryId) throw new Error(`Invalid category_id: ${state.category_id}`);

      const config = await this.integrationService.getIntegrationConfig('surepass');
      const configData = typeof config === 'string' ? JSON.parse(config) : config;

      if (!configData?.base_url) throw new Error('Surepass base_url missing');
      if (!configData?.api_key) throw new Error('Surepass API key missing');

      const existing = await this.dataSource.query(
        `SELECT * FROM user_kyc_documents WHERE user_id = ? AND document_type = 'aadhaar' LIMIT 1`,
        [userId],
      );

      let aadhaar: any;

      try {
        const response = await this.http.axiosRef.get(
          `${configData.base_url}/api/v1/digilocker/download-aadhaar/${query.client_id}`,
          { headers: { Authorization: `Bearer ${configData.api_key}` } },
        );
        aadhaar = response.data;
        this.logger.log('Aadhaar downloaded successfully');
      } catch (error: any) {
        const err = error?.response?.data;
        this.logger.error('Aadhaar download failed');
        this.logger.error(JSON.stringify(err || error?.message, null, 2));

        if (error?.response?.status === 422 && err?.message_code === 'already_downloaded') {
          this.logger.warn('Aadhaar already downloaded');
          if (!existing.length) {
            throw new Error('Aadhaar already downloaded but no database record exists.');
          }
          try {
            aadhaar = JSON.parse(existing[0].doc_details);
          } catch {
            throw new Error('Existing Aadhaar doc_details contains invalid JSON.');
          }
        } else {
          throw error;
        }
      }

      const xml = aadhaar?.data?.aadhaar_xml_data || {};
      const metadata = aadhaar?.data?.digilocker_metadata || {};

      if (!xml.masked_aadhaar) {
        throw new Error('masked_aadhaar missing from Surepass response');
      }

      if (existing.length > 0) {
        await this.dataSource.query(
          `
          UPDATE user_kyc_documents
          SET category_id = ?, country_id = ?, document_number = ?, doc_details = ?,
              verification_status = 'approved', updated_at = NOW()
          WHERE id = ?
          `,
          [categoryId, countryId, xml.masked_aadhaar, JSON.stringify(aadhaar), existing[0].id],
        );
      } else {
        await this.dataSource.query(
          `
          INSERT INTO user_kyc_documents
            (category_id, country_id, user_id, document_type, document_number,
             doc_details, verification_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          `,
          [categoryId, countryId, userId, 'aadhaar', xml.masked_aadhaar, JSON.stringify(aadhaar), 'approved'],
        );
      }

      return {
        success: true,
        client_id: query.client_id,
        alreadyVerified: existing.length > 0,
        user_id: userId,
        country_id: countryId,
        category_id: categoryId,
        name: xml.full_name ?? metadata.name ?? null,
        masked_aadhaar: xml.masked_aadhaar,
        dob: xml.dob ?? metadata.dob ?? null,
        gender: xml.gender ?? metadata.gender ?? null,
        mobile: metadata.mobile_number ?? null,
        address: xml.full_address ?? null,
        xml_url: aadhaar?.data?.xml_url ?? null,
      };
    } catch (error: any) {
      this.logger.error('===== DigiLocker Service Error =====');
      this.logger.error(error?.stack || error?.message || String(error));
      if (error?.response?.data) {
        this.logger.error(JSON.stringify(error.response.data, null, 2));
      }

      return {
        success: false,
        message: error?.response?.data?.message || error?.message || 'Something went wrong',
      };
    }
  }

  /**
   * Surepass DigiLocker webhook — server-to-server, hit independently
   * of (and potentially before/after) the browser redirect callback.
   *
   * FIX: this previously inserted the literal values 2, 2, 2 for
   * category_id/country_id/user_id on every single webhook call,
   * regardless of which user actually completed verification —
   * meaning any webhook-driven insert silently corrupted user 2's
   * Aadhaar record with whoever most recently verified. This now
   * parses the same `state` payload we set in initializeDigilocker
   * (Surepass echoes it back), exactly like handleCallback does, and
   * reuses the download-aadhaar call so the webhook path stores real,
   * correctly-attributed data — acting as a resilient fallback if the
   * browser redirect callback never fires (tab closed early, etc).
   */
  async handleWebhook(body: any) {
    try {
      this.logger.log('===== DigiLocker Webhook =====');
      this.logger.log(JSON.stringify(body, null, 2));

      if (body.status !== 'success') {
        this.logger.warn(`Webhook status: ${body.status}`);
        return { success: false, message: 'DigiLocker webhook reported non-success status' };
      }

      let state: any = {};
      if (body.state) {
        try {
          state = typeof body.state === 'string' ? JSON.parse(body.state) : body.state;
        } catch {
          this.logger.error('Webhook: invalid state JSON, cannot attribute this event to a user');
          return { success: false, message: 'Invalid state JSON' };
        }
      }

      const userId = Number(state.user_id);
      const countryId = Number(state.country_id);
      const categoryId = Number(state.category_id);

      if (!userId || !countryId || !categoryId) {
        this.logger.error(`Webhook: incomplete state (user_id=${userId}, country_id=${countryId}, category_id=${categoryId})`);
        return { success: false, message: 'Incomplete state in webhook payload' };
      }

      const existing = await this.dataSource.query(
        `SELECT * FROM user_kyc_documents WHERE user_id = ? AND document_type = 'aadhaar' LIMIT 1`,
        [userId],
      );

      // If the redirect callback already saved this user's Aadhaar,
      // there's nothing left for the webhook to do.
      if (existing.length > 0 && existing[0].verification_status === 'approved') {
        this.logger.log(`Webhook: Aadhaar already approved for user ${userId}, skipping`);
        return { success: true, alreadyProcessed: true };
      }

      // Webhook payloads sometimes include the Aadhaar data inline
      // (body.data), sometimes only a client_id to fetch it with —
      // handle both.
      let aadhaar: any = body.data ? { data: body.data } : null;

      if (!aadhaar && body.client_id) {
        const config = await this.integrationService.getIntegrationConfig('surepass');
        const configData = typeof config === 'string' ? JSON.parse(config) : config;

        const response = await this.http.axiosRef.get(
          `${configData.base_url}/api/v1/digilocker/download-aadhaar/${body.client_id}`,
          { headers: { Authorization: `Bearer ${configData.api_key}` } },
        );
        aadhaar = response.data;
      }

      if (!aadhaar) {
        this.logger.error('Webhook: no inline data and no client_id to fetch Aadhaar with');
        return { success: false, message: 'No Aadhaar data available in webhook payload' };
      }

      const xml = aadhaar?.data?.aadhaar_xml_data || {};
      const documentNumber = xml.masked_aadhaar || body.aadhaar_number || null;

      if (existing.length > 0) {
        await this.dataSource.query(
          `
          UPDATE user_kyc_documents
          SET category_id = ?, country_id = ?, document_number = ?, doc_details = ?,
              verification_status = 'approved', updated_at = NOW()
          WHERE id = ?
          `,
          [categoryId, countryId, documentNumber, JSON.stringify(aadhaar), existing[0].id],
        );
      } else {
        await this.dataSource.query(
          `
          INSERT INTO user_kyc_documents
            (category_id, country_id, user_id, document_type, document_number,
             doc_details, verification_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          `,
          [categoryId, countryId, userId, 'aadhaar', documentNumber, JSON.stringify(aadhaar), 'approved'],
        );
      }

      return { success: true, user_id: userId };
    } catch (error: any) {
      this.logger.error('===== DigiLocker Webhook Error =====');
      this.logger.error(error?.stack || error?.message || String(error));
      // Webhooks generally shouldn't throw back to the caller (Surepass
      // will retry on non-2xx) — return a soft failure instead.
      return { success: false, message: error?.message || 'Webhook processing failed' };
    }
  }
}
