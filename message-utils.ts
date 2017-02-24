interface Button {
    type: string;
    title: string;
}

interface URLButton extends Button {
    url: string;
    webview_height_ratio?: string;
    messenger_extensions?: string;
    fallback_url?: string;
}

interface PostbackButton extends Button {
    payload: string;
}

export function buttonMessage(text: string, buttons: Array<Button>) {
    let message =  {
        "attachment":{
            "type":"template",
            "payload":{
                "template_type": "button",
                "text": text,
                "buttons": buttons
            }
        }
    }
    return message;
}

export function quickReplyMessage(text: string, quickReplies: Array<string>) {
    let message = {
        text: text,
        quick_replies: quickReplies.map(q => ({content_type: "text", title: q, payload: q})),
    };
    return message;
}