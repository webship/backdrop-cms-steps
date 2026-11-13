@administration
Feature: Administration pages by name
  As a tester of a site
  I want to open the administration pages by the name a person knows them by
  So that scenarios do not carry paths

  Scenario Outline: The administrator opens the "<page>" administration page
    Given I am logged in as "admin"
    When I go to the "<page>" administration page
    Then the page heading should be "<heading>"

    Examples:
      | page                        | heading               |
      | dashboard                   | Dashboard             |
      | content                     | Content               |
      | files                       | Content               |
      | add content                 | Add content           |
      | user accounts               | Manage user accounts  |
      | roles                       | Roles                 |
      | permissions                 | Permissions           |
      | layouts                     | Layouts               |
      | menus                       | Menus                 |
      | taxonomy                    | Taxonomy              |
      | content types               | Content types         |
      | views                       | Views                 |
      | site information            | Site information      |
      | status report               | Status report         |
      | configuration manager       | Configuration manager |
      | single configuration export | Configuration manager |
      | recent log messages         | Recent log messages   |

  Scenario: An administration page opens by its path
    Given I am logged in as "admin"
    And I am on the "admin/structure/menu/settings" administration page
    Then the page heading should be "Menus"

  Scenario: The dashboard shows its blocks
    Given I am logged in as "editor"
    And I am on the "dashboard" administration page
    Then I should see the block titled "Create content"
    And I should see the block titled "Content overview"
    And the page should use the "Sutro" layout template
