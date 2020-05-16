import dialogHelper from 'dialogHelper';
import connectionManager from 'connectionManager';
import dom from 'dom';
import loading from 'loading';
import scrollHelper from 'scrollHelper';
import layoutManager from 'layoutManager';
import globalize from 'globalize';
import template from 'text!./subtitleuploader.template.html';
import 'require';
import 'emby-button';
import 'emby-select';
import 'formDialogStyle';
import 'css!./style';

var currentItemId;
var currentServerId;
var currentFile;
var hasChanges = false;

function onFileReaderError(evt) {
    loading.hide();

    const error = evt.target.error;
    if (error.code !== error.ABORT_ERR) {
        require(['toast'], function (toast) {
            toast(globalize.translate('MessageFileReadError'));
        });
    }
}

function isValidSubtitleFile(file) {
    return file && ['.sub', '.srt', '.vtt', '.ass', '.ssa']
        .some(function(ext) {
            return file.name.endsWith(ext);
        });
}

function setFiles(page, files) {
    const file = files[0];

    if (!isValidSubtitleFile(file)) {
        page.querySelector('#subtitleOutput').innerHTML = '';
        page.querySelector('#fldUpload').classList.add('hide');
        page.querySelector('#labelDropSubtitle').classList.remove('hide');
        currentFile = null;
        return;
    }

    currentFile = file;

    const reader = new FileReader();

    reader.onerror = onFileReaderError;
    reader.onloadstart = function () {
        page.querySelector('#fldUpload').classList.add('hide');
    };
    reader.onabort = function () {
        loading.hide();
        console.debug('File read cancelled');
    };

    // Closure to capture the file information.
    reader.onload = (function (theFile) {
        return function () {
            // Render file.
            const html = '<a><i class="material-icons" style="transform: translateY(25%);">subtitles</i><span>' + escape(theFile.name) + '</span><a/>';

            page.querySelector('#subtitleOutput').innerHTML = html;
            page.querySelector('#fldUpload').classList.remove('hide');
            page.querySelector('#labelDropSubtitle').classList.add('hide');
        };
    })(file);

    // Read in the subtitle file as a data URL.
    reader.readAsDataURL(file);
}

function onSubmit(e) {
    const file = currentFile;

    if (!isValidSubtitleFile(file)) {
        require(['toast'], function (toast) {
            toast(globalize.translate('MessageSubtitleFileTypeAllowed'));
        });
        e.preventDefault();
        return;
    }

    loading.show();

    const dlg = dom.parentWithClass(this, 'dialog');
    const language = dlg.querySelector('#selectLanguage').value;
    const isForced = dlg.querySelector('#chkIsForced').checked;

    connectionManager.getApiClient(currentServerId).uploadItemSubtitle(currentItemId, language, isForced, file).then(function () {
        dlg.querySelector('#uploadSubtitle').value = '';
        loading.hide();
        hasChanges = true;
        dialogHelper.close(dlg);
    });

    e.preventDefault();
}

function initEditor(page) {
    page.querySelector('.uploadSubtitleForm').addEventListener('submit', onSubmit);
    page.querySelector('#uploadSubtitle').addEventListener('change', function () {
        setFiles(page, this.files);
    });
    page.querySelector('.btnBrowse').addEventListener('click', function () {
        page.querySelector('#uploadSubtitle').click();
    });
}

function showEditor(options, resolve, reject) {
    options = options || {};
    currentItemId = options.itemId;
    currentServerId = options.serverId;

    const dialogOptions = {
        removeOnClose: true,
        scrollY: false
    };

    if (layoutManager.tv) {
        dialogOptions.size = 'fullscreen';
    } else {
        dialogOptions.size = 'small';
    }

    const dlg = dialogHelper.createDialog(dialogOptions);

    dlg.classList.add('formDialog');
    dlg.classList.add('subtitleUploaderDialog');

    dlg.innerHTML = globalize.translateDocument(template, 'core');

    if (layoutManager.tv) {
        scrollHelper.centerFocus.on(dlg, false);
    }

    // Has to be assigned a z-index after the call to .open()
    dlg.addEventListener('close', function () {
        if (layoutManager.tv) {
            scrollHelper.centerFocus.off(dlg, false);
        }
        loading.hide();
        resolve(hasChanges);
    });

    dialogHelper.open(dlg);

    initEditor(dlg);

    const selectLanguage = dlg.querySelector('#selectLanguage');

    if (options.languages) {
        selectLanguage.innerHTML = options.languages.list || null;
        selectLanguage.value = options.languages.value || null;
    }

    dlg.querySelector('.btnCancel').addEventListener('click', function () {
        dialogHelper.close(dlg);
    });
}

export function show(options) {
    return new Promise(function (resolve, reject) {
        hasChanges = false;
        showEditor(options, resolve, reject);
    });
}

export default {
    show: show
};
