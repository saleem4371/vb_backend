import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { IntegrationService } from '../integSettings/integSettings.service';
import { DataSource } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

@Injectable()
export class SurepassService {
  private readonly logger = new Logger(SurepassService.name);

  constructor(
    private readonly integrationService: IntegrationService,
    private readonly http: HttpService,
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  // ============================================================
  // COMMON HELPERS
  // ============================================================

  private getSingularCategory(category: any): string {
    const value = String(category || '').trim();

    if (!value) {
      throw new BadRequestException('Category is required');
    }

    return value.endsWith('s') ? value.slice(0, -1) : value;
  }

  private async getSurepassConfig(): Promise<any> {
    const config = await this.integrationService.getIntegrationConfig(
      'surepass',
    );

    const configData =
      typeof config === 'string'
        ? JSON.parse(config)
        : config;

    if (!configData?.base_url) {
      throw new Error('Surepass base_url missing');
    }

    if (!configData?.api_key) {
      throw new Error('Surepass API key missing');
    }

    return configData;
  }

  private getSurepassHeaders(apiKey: string) {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private safeJsonParse(value: any, fallback: any = {}) {
    if (!value) {
      return fallback;
    }

    if (typeof value === 'object') {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  // ============================================================
  // PAN VERIFICATION
  // ============================================================

  async verifyPan(
    body: any,
    id: any,
    category: any,
    country: any,
  ) {
    try {
      if (!body?.pan) {
        throw new BadRequestException('PAN number is required');
      }

      const userId = Number(id);
      const countryId = Number(country);

      if (!userId) {
        throw new BadRequestException('Invalid user id');
      }

      if (!countryId) {
        throw new BadRequestException('Invalid country id');
      }

      const singular = this.getSingularCategory(category);

      const [categoryData] = await this.dataSource.query(
        `
        SELECT *
        FROM category
        WHERE name = ?
        LIMIT 1
        `,
        [singular],
      );

      if (!categoryData) {
        throw new BadRequestException(
          `Category not found: ${singular}`,
        );
      }

      const configData = await this.getSurepassConfig();

      // ----------------------------------------------------------
      // Check PAN for CURRENT USER only
      // ----------------------------------------------------------

      const [existingPan] = await this.dataSource.query(
        `
        SELECT *
        FROM user_kyc_documents
        WHERE user_id = ?
          AND document_type = 'pan'
          AND document_number = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [userId, body.pan],
      );

      let panData: any;

      // ----------------------------------------------------------
      // Existing PAN
      // ----------------------------------------------------------

      if (existingPan) {
        panData = this.safeJsonParse(
          existingPan.doc_details,
          {},
        );
      }

      // ----------------------------------------------------------
      // New PAN -> Surepass
      // ----------------------------------------------------------

      else {
        const panResponse = await this.http.axiosRef.post(
          `${configData.base_url}/api/v1/pan/pan-comprehensive`,
          {
            id_number: body.pan,
            get_address: true,
          },
          {
            headers: this.getSurepassHeaders(
              configData.api_key,
            ),
          },
        );

        panData = panResponse?.data?.data;

        if (!panData) {
          throw new Error(
            'Invalid response from Surepass PAN API',
          );
        }
      }

      // ----------------------------------------------------------
      // ALWAYS INSERT NEW PAN RECORD
      // ----------------------------------------------------------

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
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `,
        [
          categoryData.id,
          countryId,
          userId,
          'pan',
          body.pan,
          '',
          'pending',
          JSON.stringify(panData || {}),
          0,
          null,
        ],
      );

      // ==========================================================
      // GST VERIFICATION FOR BUSINESS
      // ==========================================================

      if (String(body.category || '').toLowerCase() === 'business') {
        let gstData: any = null;
        let gstin = '';

        // --------------------------------------------------------
        // Find GST for CURRENT USER
        // --------------------------------------------------------

        const [existingGST] = await this.dataSource.query(
          `
          SELECT *
          FROM user_kyc_documents
          WHERE user_id = ?
            AND document_type = 'gst'
          ORDER BY id DESC
          LIMIT 1
          `,
          [userId],
        );

        if (existingGST) {
          gstData = this.safeJsonParse(
            existingGST.doc_details,
            {},
          );

          gstin = existingGST.document_number || '';
        }

        // --------------------------------------------------------
        // GST not found -> Surepass
        // --------------------------------------------------------

        else {
          try {
            const gstResponse =
              await this.http.axiosRef.post(
                `${configData.base_url}/api/v1/corporate/gstin-by-pan`,
                {
                  id_number: body.pan,
                },
                {
                  headers:
                    this.getSurepassHeaders(
                      configData.api_key,
                    ),
                },
              );

            gstData = gstResponse?.data?.data;

            gstin =
              gstData?.gstin_list?.[0]?.gstin || '';
          } catch (error: any) {
            this.logger.error(
              'GST Verification Error',
            );

            this.logger.error(
              JSON.stringify(
                error?.response?.data ||
                  error?.message ||
                  error,
                null,
                2,
              ),
            );

            throw error;
          }
        }

        // --------------------------------------------------------
        // Save GST
        // --------------------------------------------------------

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
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `,
            [
              categoryData.id,
              countryId,
              userId,
              'gst',
              gstin,
              '',
              'approved',
              JSON.stringify(gstData),
              0,
              null,
            ],
          );
        }
      }

      // ==========================================================
      // GET LATEST PAN
      // ==========================================================

      const [dbRow] = await this.dataSource.query(
        `
        SELECT *
        FROM user_kyc_documents
        WHERE user_id = ?
          AND document_type = 'pan'
        ORDER BY id DESC
        LIMIT 1
        `,
        [userId],
      );

      if (!dbRow) {
        throw new Error(
          'PAN record was not saved',
        );
      }

      const details = this.safeJsonParse(
        dbRow.doc_details,
        {},
      );

      // ==========================================================
      // GET LATEST GST
      // ==========================================================

      const [gstRow] = await this.dataSource.query(
        `
        SELECT *
        FROM user_kyc_documents
        WHERE user_id = ?
          AND document_type = 'gst'
        ORDER BY id DESC
        LIMIT 1
        `,
        [userId],
      );

      const gstDetails = gstRow
        ? this.safeJsonParse(
            gstRow.doc_details,
            null,
          )
        : null;

      // ==========================================================
      // RESPONSE
      // ==========================================================

      return {
        success: true,

        company_name:
          details?.full_name || '',

        pan_number:
          dbRow?.document_number || '',

        business_category:
          details?.category || 'person',

        gst_number:
          gstRow?.document_number || '',

        gst_details:
          gstDetails,

        registered_address:
          details?.address?.full ||
          [
            details?.address?.city,
            details?.address?.state,
            details?.address?.zip,
          ]
            .filter(Boolean)
            .join(', '),
      };
    } catch (error: any) {
      this.logger.error(
        '===== PAN Verification Error =====',
      );

      this.logger.error(
        error?.stack ||
          error?.message ||
          String(error),
      );

      if (error?.response?.data) {
        this.logger.error(
          JSON.stringify(
            error.response.data,
            null,
            2,
          ),
        );
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        error?.response?.data?.message ||
          error?.message ||
          'PAN verification failed',
      );
    }
  }

  // ============================================================
  // BANK VERIFICATION
  // ============================================================

  async verifyBank(
    body: any,
    id: any,
    category: any,
    country: any,
  ) {
    try {
      if (!body?.acct) {
        throw new BadRequestException(
          'Account number is required',
        );
      }

      if (!body?.cleanIFSC) {
        throw new BadRequestException(
          'IFSC is required',
        );
      }

      const userId = Number(id);
      const countryId = Number(country);

      if (!userId) {
        throw new BadRequestException(
          'Invalid user id',
        );
      }

      if (!countryId) {
        throw new BadRequestException(
          'Invalid country id',
        );
      }

      const singular =
        this.getSingularCategory(category);

      const [categoryData] =
        await this.dataSource.query(
          `
          SELECT *
          FROM category
          WHERE name = ?
          LIMIT 1
          `,
          [singular],
        );

      if (!categoryData) {
        throw new BadRequestException(
          `Category not found: ${singular}`,
        );
      }

      const configData =
        await this.getSurepassConfig();

      let bankData: any = null;

      // ----------------------------------------------------------
      // Find existing account FOR CURRENT USER
      // ----------------------------------------------------------

      const [existingBank] =
        await this.dataSource.query(
          `
          SELECT *
          FROM user_kyc_bank_details
          WHERE user_id = ?
            AND account_number = ?
          ORDER BY id DESC
          LIMIT 1
          `,
          [userId, body.acct],
        );

      // ----------------------------------------------------------
      // Existing bank
      // ----------------------------------------------------------

      if (existingBank) {
        bankData = existingBank;
      }

      // ----------------------------------------------------------
      // New bank -> Surepass
      // ----------------------------------------------------------

      else {
        try {
          const response =
            await this.http.axiosRef.post(
              `${configData.base_url}/api/v1/bank-verification/pennyless`,
              {
                id_number: body.acct,
                ifsc: body.cleanIFSC,
                ifsc_details: true,
              },
              {
                headers:
                  this.getSurepassHeaders(
                    configData.api_key,
                  ),
              },
            );

          bankData =
            response?.data?.data;

          if (!bankData) {
            throw new Error(
              'Invalid bank verification response',
            );
          }
        } catch (error: any) {
          this.logger.error(
            'Bank Verification Error',
          );

          this.logger.error(
            JSON.stringify(
              error?.response?.data ||
                error?.message ||
                error,
              null,
              2,
            ),
          );

          throw new BadRequestException(
            error?.response?.data?.message ||
              'Bank verification failed',
          );
        }
      }

      // ----------------------------------------------------------
      // ALWAYS INSERT NEW BANK RECORD
      // ----------------------------------------------------------

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
          countryId,
          userId,

          existingBank
            ? existingBank.bank_name
            : bankData?.ifsc_details
                ?.bank_name || null,

          existingBank
            ? existingBank.account_number
            : bankData?.account_number ||
              body.acct,

          existingBank
            ? existingBank.ifsc
            : bankData?.ifsc_details
                ?.ifsc ||
              body.cleanIFSC,

          body.accountType ||
            existingBank?.account_type ||
            'SAVINGS',

          existingBank
            ? existingBank.business_name
            : bankData?.full_name ||
              null,

          existingBank
            ? existingBank.branch_name
            : bankData?.ifsc_details
                ?.branch || null,

          body.businessType ||
            existingBank?.business_type ||
            null,
        ],
      );

      // ----------------------------------------------------------
      // Return latest record
      // ----------------------------------------------------------

      const [bank] =
        await this.dataSource.query(
          `
          SELECT *
          FROM user_kyc_bank_details
          WHERE user_id = ?
            AND account_number = ?
          ORDER BY id DESC
          LIMIT 1
          `,
          [userId, body.acct],
        );

      return {
        success: true,
        bank,
      };
    } catch (error: any) {
      this.logger.error(
        '===== Bank Verification Error =====',
      );

      this.logger.error(
        error?.stack ||
          error?.message ||
          String(error),
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        error?.response?.data?.message ||
          error?.message ||
          'Bank verification failed',
      );
    }
  }

  // ============================================================
  // DIGILOCKER INITIALIZE
  // ============================================================

  async verifyAdhar(
    body: any,
    userId: number,
    categoryId: number,
    countryId: number,
    
  ) {
    try {
      if (!Number(userId)) {
        throw new BadRequestException(
          'Invalid user id',
        );
      }

      if (!Number(countryId)) {
        throw new BadRequestException(
          'Invalid country id',
        );
      }

     

      const configData =
        await this.getSurepassConfig();

      const appUrl =
        String(
          process.env.APP_URL || '',
        ).replace(/\/$/, '');

      if (!appUrl) {
        throw new Error(
          'APP_URL is missing',
        );
      }

      const redirectUrl =
        `${appUrl}/thirdParty/digilocker/callback`;

      const state = JSON.stringify({
        user_id: Number(userId),
        country_id: Number(countryId),
        category_id: 1,
      });

      this.logger.log(
        '===== DigiLocker Initialize =====',
      );

      this.logger.log(
        JSON.stringify(
          {
            user_id: Number(userId),
            country_id: Number(countryId),
            category_id: 1,
            redirect_url: redirectUrl,
          },
          null,
          2,
        ),
      );

      const { data } =
        await this.http.axiosRef.post(
          `${configData.base_url}/api/v1/digilocker/initialize`,
          {
            data: {
              signup_flow: true,

              state,

              logo_url:
                'https://venuebook-psi.vercel.app/_next/static/media/logo.0e72csmjxihn9.svg',

              redirect_url:
                redirectUrl,

              skip_main_screen: false,

              aadhaar_xml: true,
            },
          },
          {
            headers:
              this.getSurepassHeaders(
                configData.api_key,
              ),
          },
        );

      this.logger.log(
        'DigiLocker initialized successfully',
      );

      return data;
    } catch (error: any) {
      this.logger.error(
        '===== DigiLocker Initialize Error =====',
      );

      this.logger.error(
        error?.stack ||
          error?.message ||
          String(error),
      );

      if (error?.response?.data) {
        this.logger.error(
          JSON.stringify(
            error.response.data,
            null,
            2,
          ),
        );
      }

      throw new BadRequestException(
        error?.response?.data?.message ||
          error?.message ||
          'DigiLocker initialization failed',
      );
    }
  }

  // ============================================================
  // DIGILOCKER CALLBACK
  // ============================================================

  async handleCallback(query: any) {
    try {
      this.logger.log(
        '===== DigiLocker Callback =====',
      );

      this.logger.log(
        JSON.stringify(
          query,
          null,
          2,
        ),
      );

      // ----------------------------------------------------------
      // STATUS
      // ----------------------------------------------------------

      if (
        String(query?.status || '').toLowerCase() !==
        'success'
      ) {
        this.logger.warn(
          `DigiLocker status: ${query?.status}`,
        );

        return {
          success: false,
          message:
            'DigiLocker verification failed',
        };
      }

      // ----------------------------------------------------------
      // CLIENT ID
      // ----------------------------------------------------------

      if (!query?.client_id) {
        throw new Error(
          'client_id is missing',
        );
      }

      // ----------------------------------------------------------
      // STATE
      // ----------------------------------------------------------

      let state: any = {};

      if (query?.state) {
        try {
          state =
            typeof query.state === 'string'
              ? JSON.parse(query.state)
              : query.state;
        } catch {
          throw new Error(
            'Invalid state JSON',
          );
        }
      }

      this.logger.log(
        '===== Parsed State =====',
      );

      this.logger.log(
        JSON.stringify(
          state,
          null,
          2,
        ),
      );

      // ----------------------------------------------------------
      // USER
      // ----------------------------------------------------------

      const userId = Number(
        state?.user_id,
      );

      if (!userId) {
        throw new Error(
          `Invalid user_id: ${state?.user_id}`,
        );
      }

      // ----------------------------------------------------------
      // COUNTRY
      // ----------------------------------------------------------

      const countryId = Number(
        state?.country_id,
      );

      if (!countryId) {
        throw new Error(
          `Invalid country_id: ${state?.country_id}`,
        );
      }

      // ----------------------------------------------------------
      // CATEGORY
      // ----------------------------------------------------------

      const categoryId = Number(
        state?.category_id,
      );

      if (!categoryId) {
        throw new Error(
          `Invalid category_id: ${state?.category_id}`,
        );
      }

      this.logger.log(
        `userId     = ${userId}`,
      );

      this.logger.log(
        `countryId  = ${countryId}`,
      );

      this.logger.log(
        `categoryId = ${categoryId}`,
      );

      // ----------------------------------------------------------
      // SUREPASS CONFIG
      // ----------------------------------------------------------

      const configData =
        await this.getSurepassConfig();

      // ----------------------------------------------------------
      // EXISTING AADHAAR
      // ----------------------------------------------------------

      const existing =
        await this.dataSource.query(
          `
          SELECT *
          FROM user_kyc_documents
          WHERE user_id = ?
            AND document_type = 'aadhaar'
          ORDER BY id DESC
          LIMIT 1
          `,
          [userId],
        );

      this.logger.log(
        `Existing Aadhaar records: ${existing.length}`,
      );

      // ----------------------------------------------------------
      // DOWNLOAD AADHAAR
      // ----------------------------------------------------------

      let aadhaar: any;

      try {
        const response =
          await this.http.axiosRef.get(
            `${configData.base_url}/api/v1/digilocker/download-aadhaar/${query.client_id}`,
            {
              headers: {
                Authorization:
                  `Bearer ${configData.api_key}`,
              },
            },
          );

        aadhaar =
          response?.data;

        this.logger.log(
          'Aadhaar downloaded successfully',
        );
      } catch (error: any) {
        const err =
          error?.response?.data;

        this.logger.error(
          'Aadhaar download failed',
        );

        this.logger.error(
          JSON.stringify(
            err ||
              error?.message ||
              error,
            null,
            2,
          ),
        );

        // --------------------------------------------------------
        // ALREADY DOWNLOADED
        // --------------------------------------------------------

        if (
          error?.response?.status === 422 &&
          err?.message_code ===
            'already_downloaded'
        ) {
          this.logger.warn(
            'Aadhaar already downloaded',
          );

          if (!existing.length) {
            throw new Error(
              'Aadhaar already downloaded but no database record exists.',
            );
          }

          aadhaar =
            this.safeJsonParse(
              existing[0].doc_details,
              null,
            );

          if (!aadhaar) {
            throw new Error(
              'Existing Aadhaar doc_details contains invalid JSON.',
            );
          }
        } else {
          throw error;
        }
      }

      // ----------------------------------------------------------
      // EXTRACT AADHAAR DATA
      // ----------------------------------------------------------

      const xml =
        aadhaar?.data
          ?.aadhaar_xml_data || {};

      const metadata =
        aadhaar?.data
          ?.digilocker_metadata || {};

      this.logger.log(
        '===== Aadhaar XML =====',
      );

      this.logger.log(
        JSON.stringify(
          xml,
          null,
          2,
        ),
      );

      if (!xml?.masked_aadhaar) {
        throw new Error(
          'masked_aadhaar missing from Surepass response',
        );
      }

      // ----------------------------------------------------------
      // SAVE / UPDATE
      // ----------------------------------------------------------

      this.logger.log(
        '===== KYC SAVE START =====',
      );

      // ----------------------------------------------------------
      // UPDATE EXISTING
      // ----------------------------------------------------------

      if (existing.length > 0) {
        this.logger.log(
          `Updating KYC ID: ${existing[0].id}`,
        );

        await this.dataSource.query(
          `
          UPDATE user_kyc_documents
          SET
            category_id = ?,
            country_id = ?,
            document_number = ?,
            doc_details = ?,
            verification_status = 'approved',
            updated_at = NOW()
          WHERE id = ?
          `,
          [
            categoryId,
            countryId,
            xml.masked_aadhaar,
            JSON.stringify(aadhaar),
            existing[0].id,
          ],
        );

        this.logger.log(
          '===== KYC UPDATE SUCCESS =====',
        );
      }

      // ----------------------------------------------------------
      // INSERT NEW
      // ----------------------------------------------------------

      else {
        this.logger.log(
          '===== INSERTING NEW KYC =====',
        );

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
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          `,
          [
            categoryId,
            countryId,
            userId,
            'aadhaar',
            xml.masked_aadhaar,
            '',
            'approved',
            JSON.stringify(aadhaar),
          ],
        );

        this.logger.log(
          '===== KYC INSERT SUCCESS =====',
        );
      }

      // ----------------------------------------------------------
      // RESPONSE
      // ----------------------------------------------------------

      return {
        success: true,

        client_id:
          query.client_id,

        alreadyVerified:
          existing.length > 0,

        user_id:
          userId,

        country_id:
          countryId,

        category_id:
          categoryId,

        name:
          xml?.full_name ??
          metadata?.name ??
          null,

        masked_aadhaar:
          xml?.masked_aadhaar,

        dob:
          xml?.dob ??
          metadata?.dob ??
          null,

        gender:
          xml?.gender ??
          metadata?.gender ??
          null,

        mobile:
          metadata?.mobile_number ??
          null,

        address:
          xml?.full_address ??
          null,

        xml_url:
          aadhaar?.data?.xml_url ??
          null,
      };
    } catch (error: any) {
      this.logger.error(
        '===== DigiLocker Service Error =====',
      );

      this.logger.error(
        error?.stack ||
          error?.message ||
          String(error),
      );

      if (error?.response?.data) {
        this.logger.error(
          JSON.stringify(
            error.response.data,
            null,
            2,
          ),
        );
      }

      return {
        success: false,

        message:
          error?.response?.data?.message ||
          error?.message ||
          'Something went wrong',
      };
    }
  }

  // ============================================================
  // UPLOAD PAN DOCUMENT
  // ============================================================

  async UploadDocument(
    document: any,
    body: any,
    userId: number,
  ) {
    try {
      if (!Number(userId)) {
        throw new BadRequestException(
          'Invalid user id',
        );
      }

      if (!body?.expected_pan) {
        throw new BadRequestException(
          'Expected PAN is required',
        );
      }

      let imagePath = '';

      if (document) {
        imagePath =
          await this.storageService.upload(
            document,
            'Documents/images',
          );
      }

      // ----------------------------------------------------------
      // Update ONLY latest PAN record
      // ----------------------------------------------------------

      const [panRecord] =
        await this.dataSource.query(
          `
          SELECT id
          FROM user_kyc_documents
          WHERE user_id = ?
            AND document_type = 'pan'
          ORDER BY id DESC
          LIMIT 1
          `,
          [userId],
        );

      if (!panRecord) {
        throw new BadRequestException(
          'PAN KYC record not found',
        );
      }

      await this.dataSource.query(
        `
        UPDATE user_kyc_documents
        SET
          document_number = ?,
          file_url = ?,
          verification_status = 'pending',
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          body.expected_pan,
          imagePath,
          panRecord.id,
        ],
      );

      return {
        success: true,
        expected_pan:
          body.expected_pan,
        imagePath,
      };
    } catch (error: any) {
      this.logger.error(
        '===== Upload PAN Error =====',
      );

      this.logger.error(
        error?.stack ||
          error?.message ||
          String(error),
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        error?.message ||
          'Document upload failed',
      );
    }
  }

  // ============================================================
  // GST VERIFICATION
  // ============================================================

  async verifyGST(
    body: any,
    userId: number,
  ) {
    // Kept according to your existing implementation.
    // Replace with actual GST logic if required.
    return true;
  }

  // ============================================================
  // DIGILOCKER WEBHOOK
  // ============================================================

  async handleWebhook(
    body: any,
    category?: any,
    country?: any,
  ) {
    try {
      this.logger.log(
        '===== DigiLocker Webhook =====',
      );

      this.logger.log(
        JSON.stringify(
          body,
          null,
          2,
        ),
      );

      // ----------------------------------------------------------
      // STATUS
      // ----------------------------------------------------------

      if (
        String(body?.status || '').toLowerCase() !==
        'success'
      ) {
        return {
          success: false,
          message:
            'DigiLocker webhook was not successful',
        };
      }

      // ----------------------------------------------------------
      // Try to get state
      // ----------------------------------------------------------

      let state: any = {};

      const rawState =
        body?.state ||
        body?.data?.state ||
        body?.metadata?.state;

      if (rawState) {
        state =
          this.safeJsonParse(
            rawState,
            {},
          );
      }

      // ----------------------------------------------------------
      // Extract IDs
      // ----------------------------------------------------------

      const userId = Number(
        body?.user_id ??
          body?.data?.user_id ??
          state?.user_id,
      );

      const countryId = Number(
        body?.country_id ??
          body?.data?.country_id ??
          state?.country_id ??
          country,
      );

      const categoryId = Number(
        body?.category_id ??
          body?.data?.category_id ??
          state?.category_id ??
          category,
      );

      // ----------------------------------------------------------
      // IMPORTANT
      // ----------------------------------------------------------

      if (!userId) {
        throw new Error(
          'Webhook user_id is missing',
        );
      }

      if (!countryId) {
        throw new Error(
          'Webhook country_id is missing',
        );
      }

      if (!categoryId) {
        throw new Error(
          'Webhook category_id is missing',
        );
      }

      // ----------------------------------------------------------
      // Aadhaar number
      // ----------------------------------------------------------

      const aadhaarNumber =
        body?.aadhaar_number ??
        body?.data?.aadhaar_number ??
        body?.data?.aadhaar_xml_data
          ?.masked_aadhaar ??
        null;

      // ----------------------------------------------------------
      // Check existing Aadhaar
      // ----------------------------------------------------------

      const [existing] =
        await this.dataSource.query(
          `
          SELECT *
          FROM user_kyc_documents
          WHERE user_id = ?
            AND document_type = 'aadhaar'
          ORDER BY id DESC
          LIMIT 1
          `,
          [userId],
        );

      // ----------------------------------------------------------
      // UPDATE
      // ----------------------------------------------------------

      if (existing) {
        await this.dataSource.query(
          `
          UPDATE user_kyc_documents
          SET
            category_id = ?,
            country_id = ?,
            document_number = ?,
            doc_details = ?,
            verification_status = 'approved',
            updated_at = NOW()
          WHERE id = ?
          `,
          [
            categoryId,
            countryId,
            aadhaarNumber,
            JSON.stringify(body),
            existing.id,
          ],
        );
      }

      // ----------------------------------------------------------
      // INSERT
      // ----------------------------------------------------------

      else {
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
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          `,
          [
            categoryId,
            countryId,
            userId,
            'aadhaar',
            aadhaarNumber,
            '',
            'approved',
            JSON.stringify(body),
          ],
        );
      }

      return {
        success: true,
        user_id: userId,
        country_id: countryId,
        category_id: categoryId,
      };
    } catch (error: any) {
      this.logger.error(
        '===== DigiLocker Webhook Error =====',
      );

      this.logger.error(
        error?.stack ||
          error?.message ||
          String(error),
      );

      return {
        success: false,
        message:
          error?.message ||
          'DigiLocker webhook failed',
      };
    }
  }
}
