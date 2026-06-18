(function () {
  const WXO_HOST_URL = "https://eu-de.watson-orchestrate.cloud.ibm.com";
  const WXO_CONFIG = {
    orchestrationID: "09be334b68a34180a9399bdf74c8a5e8_2a6df77e-738a-42eb-8224-65c43367443f",
    hostURL: WXO_HOST_URL,
    rootElementID: "root",
    showLauncher: true,
    deploymentPlatform: "ibmcloud",
    crn: "crn:v1:bluemix:public:watsonx-orchestrate:eu-de:a/09be334b68a34180a9399bdf74c8a5e8:2a6df77e-738a-42eb-8224-65c43367443f::",
    chatOptions: {
      agentId: "0f38e240-3af7-4430-aeae-21a7a779c621",
      agentEnvironmentId: "62ff094f-0367-4833-9234-a7117df25e90",
      title: "Afia Assistant",
    },
  };

  function getApiBaseUrl() {
    if (window.HEALTHIUM_API_URL) return String(window.HEALTHIUM_API_URL).replace(/\/$/, "");
    if (window.location.protocol === "file:") return "http://localhost:3000";
    return window.location.origin;
  }

  function ensureRootElement() {
    if (document.getElementById(WXO_CONFIG.rootElementID)) return;

    const root = document.createElement("div");
    root.id = WXO_CONFIG.rootElementID;
    document.body.appendChild(root);
  }

  async function fetchWatsonToken() {
    const locale = window.HealthiumI18n?.getLanguage?.() || document.documentElement.lang || "en";
    const response = await fetch(`${getApiBaseUrl()}/api/wxo-token?locale=${encodeURIComponent(locale)}`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Watson token endpoint returned ${response.status}`);
    }

    const token = (await response.text()).trim();
    if (!token) throw new Error("Watson token endpoint returned an empty token");
    return token;
  }

  async function handleAuthTokenNeeded(event, instance) {
    const token = await fetchWatsonToken();
    event.authToken = token;
    if (instance?.updateAuthToken) instance.updateAuthToken(token);
  }

  function onChatLoad(instance) {
    window.AfiaWatsonChat = instance;
    instance.on("authTokenNeeded", handleAuthTokenNeeded);
  }

  async function loadWatsonChat() {
    ensureRootElement();

    try {
      WXO_CONFIG.token = await fetchWatsonToken();
    } catch (error) {
      console.warn("Watson chat is not initialized because the token endpoint is unavailable.", error);
      return;
    }

    WXO_CONFIG.chatOptions.onLoad = onChatLoad;
    window.wxOConfiguration = WXO_CONFIG;

    const script = document.createElement("script");
    script.src = `${WXO_HOST_URL}/wxochat/wxoLoader.js?embed=true`;
    script.addEventListener("load", function () {
      window.wxoLoader.init();
    });
    document.head.appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadWatsonChat);
  } else {
    loadWatsonChat();
  }
})();
