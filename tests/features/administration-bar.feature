@administration @administration-bar
Feature: The administration bar
  As a tester of a site
  I want to use the administration bar: its menus, its search and its account links
  So that the way administrators and editors move around is covered

  @critical
  Scenario: The administrator sees every section in the administration bar
    Given I am logged in as "admin"
    Then I should see the administration bar
    And the administration bar should list "Dashboard"
    And the administration bar should list "Content"
    And the administration bar should list "User accounts"
    And the administration bar should list "Structure"
    And the administration bar should list "Configuration"
    And the administration bar should list "Reports"
    And the administration bar should show the account "admin"

  Scenario: The editor sees only the sections of the editor role
    Given I am logged in as "editor"
    Then I should see the administration bar
    And the administration bar should list "Content"
    And the administration bar should list "Structure"
    But the administration bar should not list "User accounts"
    And the administration bar should not list "Configuration"
    And the administration bar should not list "Reports"
    And the administration bar should show the account "editor"
    And the administration bar should not show the account "admin"

  Scenario: Visitors and accounts without the permission have no administration bar
    Given I am an anonymous user
    Then I should not see the administration bar
    Given I am logged in as "member"
    Then I should not see the administration bar

  Scenario: A page opens from a menu of the administration bar
    Given I am logged in as "admin"
    When I open "Structure > Layouts" from the administration bar
    Then the page heading should be "Layouts"
    When I open "Content" from the administration bar
    Then the page heading should be "Content"
    When I open "Reports > Status report" from the administration bar
    Then the page heading should be "Status report"

  Scenario: A page opens from a third level of the administration bar
    Given I am logged in as "admin"
    When I open "Configuration > Development > Configuration manager" from the administration bar
    Then the page heading should be "Configuration manager"

  Scenario: The menu search of the administration bar suggests pages
    Given I am logged in as "admin"
    When I search the administration bar for "Layouts"
    Then the administration bar search should suggest "Structure: Layouts"
    And the administration bar search should not suggest "Structure: Menus"
    When I choose "Structure: Layouts" from the administration bar search
    Then the page heading should be "Layouts"

  Scenario: The menu search only suggests pages the account may open
    Given I am logged in as "editor"
    When I search the administration bar for "Taxonomy"
    Then the administration bar search should suggest "Structure: Taxonomy"
    When I search the administration bar for "Layouts"
    Then the administration bar search should not suggest "Structure: Layouts"

  Scenario: Caches are flushed from the administration bar
    Given I am logged in as "admin"
    And I am on "/visit-the-apiary"
    When I flush all caches from the administration bar
    Then the status message should contain "cache"
    And the page heading should be "Visit the apiary"

  Scenario: Logging out from the administration bar ends the session
    Given I am logged in as "editor"
    When I log out from the administration bar
    Then I should be logged out
    And I should not see the administration bar
