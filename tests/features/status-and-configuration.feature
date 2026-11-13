@administration @system
Feature: Status report, cron and configuration
  As a tester of a site
  I want to assert the status report, run cron and read the configuration manager
  So that the health of the site and its configuration screens are covered

  # Nothing here changes the configuration of the site: the single export only
  # reads, and the single import is only shown its validation.

  Background:
    Given I am logged in as "admin"

  @critical
  Scenario: The status report has no errors
    Then the status report should not show errors
    And the status report entry "PHP" should contain "8."
    And the status report entry "MySQL Database" should contain "1"
    And the status report entry "PHP" should not contain "5.6"

  Scenario: The status report gives the kind of each entry
    Then the status report entry "MySQL Database" should be info
    And the status report entry "Trusted Host Setting" should be a warning
    And the status report should show warnings

  Scenario: Cron runs from the administration
    When I run cron
    Then the status message should contain "Cron ran successfully."
    And the status report entry "Cron maintenance tasks" should contain "Last run"

  Scenario: A configuration file is exported from the single export form
    When I export the configuration "system.core" of the group "System configuration"
    Then the exported configuration should contain "site_name"
    And the exported configuration should contain "\"_config_name\": \"system.core\""
    And the exported configuration should not contain "no-such-key-here"

  Scenario: A configuration is exported by the label of its option
    When I export the configuration "Tags" of the group "Vocabularies"
    Then the exported configuration should contain "taxonomy.vocabulary.tags"

  Scenario: The single import form refuses text that is not configuration
    Given I am on the "single configuration import" administration page
    When I enter "this is not configuration" in the "Paste your configuration here" field
    And I press "Import"
    Then there should be an error message
    And the "Paste your configuration here" field should be marked as an error
    And the configuration should not have staged changes

  Scenario: The configuration manager has no staged changes
    Then the configuration should not have staged changes
    And the page heading should be "Configuration manager"
    When I open the "Single import/export" page tab
    And I open the "Export" page tab
    Then I should see "Configuration group"
