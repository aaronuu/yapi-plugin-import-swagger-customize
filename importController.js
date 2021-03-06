const baseController = require('controllers/base.js');
const yapi = require('yapi.js');
const projectModel = require('models/project.js');
const tokenModel = require('models/token.js');
const swaggerUrlModel = require('./swaggerUrlModel');
const HanldeImportData = require('../../common/HandleImportData');
const sha = require('sha.js');
const { getToken } = require('utils/token');
const formatData = require('./run');
const axios = require('axios');

class importController extends baseController {
  constructor(ctx) {
    super(ctx);
    this.projectModel = yapi.getInst(projectModel);
    this.tokenModel = yapi.getInst(tokenModel);
    this.swaggerUrlModel = yapi.getInst(swaggerUrlModel);
  }

  // 查询swaggerURL
  async getSwaggerUrl (ctx) {
    const requestBody = ctx.request.body;
    const { projectId } = requestBody;
    if (!projectId) {
      return (ctx.body = yapi.commons.resReturn(null, 408, '缺少项目Id'));
    }
    const result = await this.swaggerUrlModel.getByProjectId(projectId);
    return (ctx.body = yapi.commons.resReturn(result, 0));
  }

  // 保存swaggerUrl
  async saveSwaggerUrl (ctx) {
    const requestBody = ctx.request.body;
    const { projectId } = requestBody;
    if (!projectId) {
      return (ctx.body = yapi.commons.resReturn(null, 408, '缺少项目Id'));
    }
    let result;
    if (requestBody._id) {
      result = await this.swaggerUrlModel.up(requestBody);
    } else {
      result = await this.swaggerUrlModel.save(requestBody);
    }
    return (ctx.body = yapi.commons.resReturn(result, 0));
  }

  // 新增、修改接口
  async updateData (ctx) {

    let successMessage;
    let errorMessage = [];
    const requestBody = ctx.request.body;
    const { importType, projectId, cat, swaggerUrl, interfaceName } = requestBody;
    if (!projectId) {
      return (ctx.body = yapi.commons.resReturn(null, 408, '缺少项目Id'));
    }
    // 获取项目信息
    const projectData = await this.projectModel.get(projectId);
    const { basepath, uid } = projectData;
    // 获取swaggerJSON
    const swaggerData = await this.getSwaggerData(swaggerUrl, ctx);

    if (swaggerData.errorMsg) {
      return (ctx.body = yapi.commons.resReturn(null, 404, swaggerData.errorMsg));
    }

    // 格式化swagger数据
    const res = await formatData(
      swaggerData,
      interfaceName,
      err => {
        errorMessage.push(err);
      }
    );
    await HanldeImportData(
      res,
      projectId,
      '',
      cat,
      basepath,
      importType === 'add' ? 'normal' : 'merge',
      err => {
        errorMessage.push(err);
      },
      msg => {
        successMessage = msg;
      },
      () => {},
      await this.getProjectToken(projectId, uid),
      yapi.WEBCONFIG.port
    );

    if (errorMessage.length > 0) {
      return (ctx.body = yapi.commons.resReturn(null, 404, errorMessage.join('\n')));
    }
    ctx.body = yapi.commons.resReturn(null, 0, successMessage);

  }
  // 获取项目token
  async getProjectToken(project_id, uid) {
    try {
        let data = await this.tokenModel.get(project_id);
        let token;
        if (!data) {
            let passsalt = yapi.commons.randStr();
            token = sha('sha1')
                .update(passsalt)
                .digest('hex')
                .substr(0, 20);

            await this.tokenModel.save({ project_id, token });
        } else {
            token = data.token;
        }

        token = getToken(token, uid);

        return token;
    } catch (err) {
        return "";
    }
  }
  // 获取swaggerJSON
  async getSwaggerData(swaggerUrl) {
    try {
      const response = await axios.get(swaggerUrl);
      return response.data;
    } catch (e) {
      return {
        errorMsg: '获取数据失败，请确认 swaggerUrl 是否正确'
      }
    }
  }
}

module.exports = importController;