import { Injectable, BadRequestException } from '@nestjs/common';

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

  //   async verifyPan(pan: string) {
  async verifyPan(body: any, id: any) {
    const config =
      await this.integrationService.getIntegrationConfig('surepass');
    const [existingPan] = await this.dataSource.query(
      `SELECT id FROM user_kyc_documents WHERE document_number = ? LIMIT 1`,
      [body.pan],
    );

    if (existingPan) {
      const [dbRow] = await this.dataSource.query(
        `SELECT *
     FROM user_kyc_documents
     WHERE user_id = ? AND document_type = 'pan'
     ORDER BY id DESC
     LIMIT 1`,
        [id],
      );

      const details = JSON.parse(dbRow.doc_details || '{}');

      return {
        company_name: details.full_name || '', // PAN holder name
        pan_number: dbRow.document_number || '', // stored PAN number
        business_category: details.category || 'person', // person/company type
        registered_address:
          details.address?.full || // full address
          [details.address?.city, details.address?.state, details.address?.zip]
            .filter(Boolean)
            .join(', ') ||
          '',
      };
    }

    const configData = typeof config === 'string' ? JSON.parse(config) : config;

    try {
      //   const response = await this.http.axiosRef.post(
      //     `${configData.base_url}/api/v1/pan/pan-comprehensive`,
      //     {
      //       id_number: body.pan,
      //       get_address: true
      //     },
      //     {
      //       headers: {
      //         Authorization: `Bearer ${configData.api_key}`,
      //         'Content-Type': 'application/json',
      //       },
      //     },
      //   );

      //  const panData = response.data.data;

      const panData = '';

      await this.dataSource.query(
        `
  INSERT INTO user_kyc_documents
  (user_id, document_type, document_number, file_url, verification_status, doc_details, verified_by, verified_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `,
        [
          id,
          'pan',
          body.pan,
          '',
          'pending',
          JSON.stringify(panData), // if JSON column
          0,
          null,
        ],
      );

      const [dbRow] = await this.dataSource.query(
        `SELECT *
     FROM user_kyc_documents
     WHERE user_id = ? AND document_type = 'pan'
     ORDER BY id DESC
     LIMIT 1`,
        [id],
      );

      const details = JSON.parse(dbRow.doc_details || '{}');

      return {
        company_name: details.full_name || '', // PAN holder name
        pan_number: dbRow.document_number || '', // stored PAN number
        business_category: details.category || 'person', // person/company type
        registered_address:
          details.address?.full || // full address
          [details.address?.city, details.address?.state, details.address?.zip]
            .filter(Boolean)
            .join(', ') ||
          '',
      };
    } catch (error: any) {
      console.log('Status:', error?.response?.status);
      console.log('Data:', error?.response?.data);
      console.log('Headers:', error?.response?.headers);

      // throw error;
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

  async verifyBank(body: any, id: any) {
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
        ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
      `,
        [
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

      return apiData;
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

    const { data } = await this.http.axiosRef.post(
      `${configData.base_url}/api/v1/digilocker/initialize`,
      {
        data: {
          signup_flow: true,
          webhook_url: `${process.env.APP_URL}/thirdParty/digilocker/callback`,
          state: `user_${Date.now()}`,
          //send_email: true,
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
}
