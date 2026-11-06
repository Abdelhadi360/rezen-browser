const fs = require('fs');
const path = require('path');
const { withDangerousMod, AndroidConfig } = require('expo/config-plugins');

const WIDGET_INTERACTION_ACTION = 'expo.modules.widgets.ACTION_WIDGET_INTERACTION';

module.exports = function withAndroidWidgetLaunch(config, { widgetNames = [] } = {}) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const androidPackage = AndroidConfig.Package.getPackage(config);
      const packageDirectory = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java',
        ...androidPackage.split('.')
      );

      for (const widgetName of widgetNames) {
        const providerName = `${widgetName}Provider`;
        const providerPath = path.join(packageDirectory, `${providerName}.kt`);
        let source = fs.readFileSync(providerPath, 'utf8');
        if (source.includes('override fun onReceive')) continue;

        const declaration = `class ${providerName} : ExpoWidgetsAppWidgetProvider(${JSON.stringify(widgetName)})`;
        if (!source.includes(declaration)) {
          throw new Error(`Could not find generated Android widget provider: ${providerName}`);
        }

        source = source.replace(
          'import expo.modules.widgets.ExpoWidgetsAppWidgetProvider',
          'import android.content.Context\nimport android.content.Intent\nimport expo.modules.widgets.ExpoWidgetsAppWidgetProvider'
        );
        source = source.replace(
          declaration,
          `class ${providerName} : ExpoWidgetsAppWidgetProvider(${JSON.stringify(widgetName)}) {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == ${JSON.stringify(WIDGET_INTERACTION_ACTION)}) {
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launchIntent ->
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        context.startActivity(launchIntent)
      }
    }
    super.onReceive(context, intent)
  }
}`
        );
        fs.writeFileSync(providerPath, source);
      }

      return config;
    },
  ]);
};