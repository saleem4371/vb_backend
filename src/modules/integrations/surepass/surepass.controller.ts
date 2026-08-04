import {
  Controller,
  Get,
  UseGuards,
  Param,
  Put,
  Req,
  Patch,
  Post,
  Body,
  Query,
  Delete,
  Res,
  Headers
} from '@nestjs/common';
import type { FastifyRequest , FastifyReply } from 'fastify';


import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

import { SurepassService } from './surepass.service';

@Controller('thirdParty')
export class SurepassController {
  constructor(private readonly surepassService: SurepassService) {}

    @UseGuards(JwtAuthGuard)
 @Post('verifyPAN')
pan_verify(@Body() body: string,@CurrentUser() user: any,@Headers('x-category') category:any , @Headers('x-country') country:any) {
  return this.surepassService.verifyPan(body, user?.id,category,country );
}
 @UseGuards(JwtAuthGuard)
 @Post('verifyGST')
verifyGST(@Body() body: string,@CurrentUser() user: any) {
  return this.surepassService.verifyGST(body,user?.id);
}  
@UseGuards(JwtAuthGuard)
 @Post('verifyBank')
verifyBank(@Body() body: string,@CurrentUser() user: any,@Headers('x-category') category:any , @Headers('x-country') country:any) {
  return this.surepassService.verifyBank(body,user?.id,category,country);
} 

@Post('verifyAdhar')
verifyAdhar(@Body() body: string) {
  return this.surepassService.verifyAdhar(body);
}
// @Post('digilocker/callback')
// callback(@Body() body: string) {
//   return this.surepassService.callback(body);
// }

// @Get('digilocker/callback')
// async callback(@Query() query, @Res() res) {
//   console.log(query); // <-- Is this getting called?

//   // Save data...

 
//   return res.redirect(
//   `https://venuebook-psi.vercel.app/vendor/kyc/success`,
// );
// }

 @Get('digilocker/callback')
async callback(@Query() query: any, @Res() reply: FastifyReply) {
  try {
    await this.surepassService.handleCallback(query);

    return reply.type('text/html').send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Verification Successful</title>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

<style>
*{
margin:0;
padding:0;
box-sizing:border-box;
}

body{
font-family:'Inter',sans-serif;
height:100vh;
display:flex;
justify-content:center;
align-items:center;
overflow:hidden;
background:
radial-gradient(circle at top left,#4F46E5,#111827 60%),
linear-gradient(135deg,#0F172A,#1E293B);
}

.bg{
position:fixed;
inset:0;
overflow:hidden;
}

.circle{
position:absolute;
border-radius:50%;
filter:blur(60px);
animation:float 12s infinite ease-in-out;
opacity:.35;
}

.circle:nth-child(1){
width:280px;
height:280px;
background:#4F46E5;
top:-60px;
left:-60px;
}

.circle:nth-child(2){
width:240px;
height:240px;
background:#06B6D4;
bottom:-70px;
right:-50px;
animation-delay:2s;
}

.circle:nth-child(3){
width:180px;
height:180px;
background:#22C55E;
top:30%;
right:18%;
animation-delay:5s;
}

.card{
position:relative;
width:420px;
max-width:92%;
background:rgba(255,255,255,.08);
backdrop-filter:blur(24px);
border:1px solid rgba(255,255,255,.15);
border-radius:24px;
padding:42px 34px;
text-align:center;
color:#fff;
box-shadow:
0 25px 70px rgba(0,0,0,.45);
animation:cardIn .8s ease;
}

.icon{
width:92px;
height:92px;
margin:auto;
border-radius:50%;
background:linear-gradient(135deg,#22C55E,#16A34A);
display:flex;
justify-content:center;
align-items:center;
box-shadow:0 0 35px rgba(34,197,94,.5);
animation:pop .7s ease;
}

.check{
width:28px;
height:50px;
border-right:5px solid #fff;
border-bottom:5px solid #fff;
transform:rotate(45deg);
margin-top:-6px;
}

h1{
margin-top:24px;
font-size:28px;
font-weight:700;
}

p{
margin-top:12px;
color:#D1D5DB;
line-height:1.7;
font-size:15px;
}

.loader{
margin:32px auto 0;
width:52px;
height:52px;
border:4px solid rgba(255,255,255,.15);
border-top:4px solid #22C55E;
border-radius:50%;
animation:spin .9s linear infinite;
}

.footer{
margin-top:24px;
font-size:13px;
color:#9CA3AF;
}

@keyframes spin{
100%{transform:rotate(360deg);}
}

@keyframes pop{
0%{transform:scale(.2);opacity:0;}
70%{transform:scale(1.15);}
100%{transform:scale(1);}
}

@keyframes cardIn{
from{
opacity:0;
transform:translateY(30px) scale(.95);
}
to{
opacity:1;
transform:translateY(0) scale(1);
}
}

@keyframes float{
50%{
transform:translateY(-40px) translateX(25px);
}
}
</style>

</head>

<body>

<div class="bg">
<div class="circle"></div>
<div class="circle"></div>
<div class="circle"></div>
</div>

<div class="card">

<div class="icon">
<div class="check"></div>
</div>

<h1>Verification Successful</h1>

<p>
Your DigiLocker verification has been completed successfully.
This window will close automatically and you'll be redirected back to the application.
</p>

<div class="loader"></div>

<div class="footer">
Securely powered by DigiLocker
</div>

</div>

<script>

const result = ${JSON.stringify(query)};

setTimeout(() => {

    if(window.opener){
        window.opener.postMessage({
            type:"DIGILOCKER_SUCCESS",
            payload:result
        },"*");
    }

    window.close();

},2500);

setTimeout(()=>{
    if(!window.closed){
        document.querySelector(".footer").innerHTML =
        'You can safely close this window.';
    }
},4000);

</script>

</body>
</html>
`);
  }
}

  @Post('digilocker/webhook')
  async webhook(@Body() body: any ,@Headers('x-category') category:any , @Headers('x-country') country:any) {
    await this.surepassService.handleWebhook(body,category,country);

    return {
      success: true,
    };
  }

@Get('initializeDigilocker')
initializeDigilocker(@Body() body: string) {
  return this.surepassService.verifyAdhar(body);
}
 @UseGuards(JwtAuthGuard)
@Post('UploadDocument')
async UploadDocument(
  @Req() req: FastifyRequest,
  @CurrentUser() user: any,
) {
  try {
    const parts = req.parts();

    const body: any = {};
    let document: any = null;

    for await (const part of parts) {
      /*
      |--------------------------------------------------------------------------
      | FILE
      |--------------------------------------------------------------------------
      */
      if (part.type === 'file') {
        if (!part.filename) {
          continue;
        }

        const buffer = await part.toBuffer();

        if (!buffer || buffer.length === 0) {
          continue;
        }

        const fileData = {
          buffer,
          filename: part.filename,
          mimetype: part.mimetype,
        };

        if (part.fieldname === 'file') {
          document = fileData;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | FIELDS
      |--------------------------------------------------------------------------
      */
      if (part.type === 'field') {
        body[part.fieldname] = String(part.value);
      }
    }

    return await this.surepassService.UploadDocument(
      document,
      body,
      user?.id,
    );
  } catch (error) {
    console.error(error);

  }
}
}
