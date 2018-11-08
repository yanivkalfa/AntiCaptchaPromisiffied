const connectionTimeout = 20;
const firstAttemptWaitingInterval = 5;
const normalWaitingInterval = 2;

class AntiCaptcha {
  constructor(clientKey) {
    this.params = {
      host: 'api.anti-captcha.com',
      port: 80,
      clientKey: clientKey,

      // reCAPTCHA 2
      websiteUrl: null,
      websiteKey: null,
      websiteSToken: null,
      proxyType: 'http',
      proxyAddress: null,
      proxyPort: null,
      proxyLogin: null,
      proxyPassword: null,
      userAgent: '',
      cookies: '',

      // FunCaptcha
      websitePublicKey: null,

      // image
      phrase: null,
      case: null,
      numeric: null,
      math: null,
      minLength: null,
      maxLength: null,

      // CustomCaptcha
      imageUrl: null,
      assignment: null,
      forms: null,

      softId: null,
      languagePool: null
    };
  }

  getBalance() {
    return new Promise((resolve, reject) => {
      const postData = { clientKey: this.params.clientKey };
      this.jsonPostRequest('getBalance', postData, (err, jsonResult) => {
        if (err) {
          return reject({ err, res: null, jsonResult });
        }

        return resolve({ err: null, res: jsonResult.balance, jsonResult });
      });
    });
  };

  createTask(type, taskData) {
    return new Promise((resolve, reject) => {
      type = typeof type == 'undefined' ? 'NoCaptchaTask' : type;
      const task = this.getPostData(type);
      task.type = type;

      const postData = {
        clientKey: this.params.clientKey,
        task: {  ...task, ...taskData },
        softId: this.params.softId !== null ? this.params.softId : 0
      };

      if (this.params.languagePool !== null) {
        postData.languagePool = this.params.languagePool;
      }

      this.jsonPostRequest('createTask', postData, (err, jsonResult) => {
        if (err) {
          return reject({ err, res: null, jsonResult });
        }

        return resolve({ err: null, res: jsonResult.taskId, jsonResult });
      });
    });
  };

  createTaskProxyless() {
    return this.createTask('NoCaptchaTaskProxyless');
  };

  createFunCaptchaTask() {
    return this.createTask('FunCaptchaTask');
  };

  createFunCaptchaTaskProxyless() {
    return this.createTask('FunCaptchaTaskProxyless');
  };

  createImageToTextTask(taskData) {
    return this.createTask('ImageToTextTask', taskData);
  };

  createCustomCaptchaTask() {
    return this.createTask('CustomCaptchaTask');
  };

  getTaskRawResult(jsonResult) {
    if (typeof jsonResult.solution.gRecaptchaResponse != 'undefined') {
      return jsonResult.solution.gRecaptchaResponse;
    } else if (typeof jsonResult.solution.token != 'undefined') {
      return jsonResult.solution.token;
    } else if (typeof jsonResult.solution.answers != 'undefined') {
      return jsonResult.solution.answers;
    } else {
      return jsonResult.solution.text;
    }
  }

  getTaskSolution(taskId, currentAttempt, tickCb) {
    return new Promise((resolve, reject) => {
      currentAttempt = currentAttempt || 0;

      const postData = {
        clientKey: this.params.clientKey,
        taskId: taskId
      };

      let waitingInterval;
      if (currentAttempt == 0) {
        waitingInterval = firstAttemptWaitingInterval;
      } else {
        waitingInterval = normalWaitingInterval;
      }

      console.log('Waiting %s seconds', waitingInterval);

      setTimeout(() => {
        this.jsonPostRequest('getTaskResult', postData, (err, jsonResult) => {
          if (err) {
            return reject({ err, res: null, jsonResult });
          }

          if (jsonResult.status == 'processing') {
            // Every call I'm ticki-ing
            if (tickCb) {
              tickCb();
            }
            return this.getTaskSolution(taskId, currentAttempt + 1, tickCb);
          } else if (jsonResult.status == 'ready') {
            return resolve({
              err: null,
              res: this.getTaskRawResult(jsonResult),
              jsonResult
            });
          }
        });
      }, waitingInterval * 1000);
    });
  };

  getPostData(type) {
    switch (type) {
      case 'CustomCaptchaTask':
        return {
          imageUrl:       this.params.imageUrl,
          assignment:     this.params.assignment,
          forms:          this.params.forms
        };
      case 'ImageToTextTask':
        return {
          phrase:         this.params.phrase,
          case:           this.params.case,
          numeric:        this.params.numeric,
          math:           this.params.math,
          minLength:      this.params.minLength,
          maxLength:      this.params.maxLength
        };
        break;
      case 'NoCaptchaTaskProxyless':
        return {
          websiteURL:     this.params.websiteUrl,
          websiteKey:     this.params.websiteKey,
          websiteSToken:  this.params.websiteSToken
        };
        break;
      case 'FunCaptchaTask':
        return {
          websiteURL:         this.params.websiteUrl,
          websitePublicKey:   this.params.websitePublicKey,
          proxyType:          this.params.proxyType,
          proxyAddress:       this.params.proxyAddress,
          proxyPort:          this.params.proxyPort,
          proxyLogin:         this.params.proxyLogin,
          proxyPassword:      this.params.proxyPassword,
          userAgent:          this.params.userAgent,
          cookies:            this.params.cookies
        };
        break;
      case 'FunCaptchaTaskProxyless':
        return {
          websiteURL:         this.params.websiteUrl,
          websitePublicKey:   this.params.websitePublicKey,
        };
      default: // NoCaptchaTask
        return {
          websiteURL:     this.params.websiteUrl,
          websiteKey:     this.params.websiteKey,
          websiteSToken:  this.params.websiteSToken,
          proxyType:      this.params.proxyType,
          proxyAddress:   this.params.proxyAddress,
          proxyPort:      this.params.proxyPort,
          proxyLogin:     this.params.proxyLogin,
          proxyPassword:  this.params.proxyPassword,
          userAgent:      this.params.userAgent,
          cookies:        this.params.cookies
        };
    }
  };

  jsonPostRequest(methodName, postData, cb) {
    if (typeof process === 'object' && typeof require === 'function') { // NodeJS
      const http = require('http');

      // http request options
      const options = {
        hostname: this.params.host,
        port: this.params.port,
        path: '/' + methodName,
        method: 'POST',
        headers: {
          'accept-encoding':  'gzip,deflate',
          'content-type':     'application/json; charset=utf-8',
          'accept':           'application/json',
          'content-length':   Buffer.byteLength(JSON.stringify(postData))
        }
      };

      // console.log(options);
      // console.log(JSON.stringify(postData));
      const req = http.request(options, (response) => { // on response
        let str = '';

        // another chunk of data has been recieved, so append it to `str`
        response.on('data', (chunk) => {
          str += chunk;
        });

        // the whole response has been recieved, so we just print it out here
        response.on('end', () => {
          // console.log(str);

          let jsonResult = null;
          try {
            jsonResult = JSON.parse(str);
          } catch (err) {
            return cb(err);
          }

          if (jsonResult.errorId) {
            return cb(new Error(jsonResult.errorDescription, jsonResult.errorCode), jsonResult);
          }

          return cb(null, jsonResult);
        });
      });

      // send post data
      req.write(JSON.stringify(postData));
      req.end();

      // timeout in milliseconds
      req.setTimeout(connectionTimeout * 1000);
      req.on('timeout', () => {
        console.log('timeout');
        req.abort();
      });

      // After timeout connection throws Error, so we have to handle it
      req.on('error', (err) => {
        console.log('error');
        return cb(err);
      });

      return req;
    } else if ((typeof window !== 'undefined' || typeof chrome === 'object') && typeof $ == 'function') { // in browser or chrome extension with jQuery
      $.ajax(
        (window.location.protocol == 'https:' ? 'https:' : 'http:') + '//'
        + this.params.host
        + (window.location.protocol != 'https:' ? ':' + this.params.port : '')
        + '/' + methodName,
        {
          method: 'POST',
          data: JSON.stringify(postData),
          dataType: 'json',
          success: (jsonResult) => {
            if (jsonResult && jsonResult.errorId) {
              return cb(new Error(jsonResult.errorDescription, jsonResult.errorCode), jsonResult);
            }

            cb(false, jsonResult);
          },
          error: (jqXHR, textStatus, errorThrown) => {
            cb(new Error(textStatus != 'error' ? textStatus : 'Unknown error, watch console')); // should be errorThrown
          }
        }
      );
    } else {
      console.error('Application should be run either in NodeJs environment or has jQuery to be included');
    }
  };

  setClientKey(value) {
    this.params.clientKey = value;
  };

  //proxy access parameters
  setWebsiteURL(value) {
    this.params.websiteUrl = value;
  };

  setWebsiteKey(value) {
    this.params.websiteKey = value;
  };

  setWebsiteSToken(value) {
    this.params.websiteSToken = value;
  };

  setWebsitePublicKey(value) {
    this.params.websitePublicKey = value;
  };

  setProxyType(value) {
    this.params.proxyType = value;
  };

  setProxyAddress(value) {
    this.params.proxyAddress = value;
  };

  setProxyPort(value) {
    this.params.proxyPort = value;
  };

  setProxyLogin(value) {
    this.params.proxyLogin = value;
  };

  setProxyPassword(value) {
    this.params.proxyPassword = value;
  };

  setUserAgent(value) {
    this.params.userAgent = value;
  };

  setCookies(value) {
    this.params.cookies = value;
  };

  // image
  setPhrase(value) {
    this.params.phrase = value;
  };

  setCase(value) {
    this.params.case = value;
  };

  setNumeric(value) {
    this.params.numeric = value;
  };

  setMath(value) {
    this.params.math = value;
  };

  setMinLength(value) {
    this.params.minLength = value;
  };

  setMaxLength(value) {
    this.params.maxLength = value;
  };

  setImageUrl(value) {
    this.params.imageUrl = value;
  };

  setAssignment(value) {
    this.params.assignment = value;
  };

  setForms(value) {
    this.params.forms = value;
  };

  setSoftId(value) {
    this.params.softId = value;
  };

  setLanguagePool(value) {
    this.params.languagePool = value;
  };

  setHost(value) {
    this.params.host = value;
  };

  setPort(value) {
    this.params.port = value;
  };
}

module.exports = AntiCaptcha;