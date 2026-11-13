@navigation
Feature: Front-end landmarks
  As a tester of a site
  I want to assert the primary navigation, the breadcrumb, the page heading, the page tabs and the pager
  So that the landmarks every page is built from are covered

  # The site build script seeds twelve promoted posts ("Field note 01" to
  # "Field note 12"), so the home page listing has two pages, and the page
  # "Visit the apiary", linked from the primary navigation.

  @critical
  Scenario: The primary navigation lists the links of the menu
    Given I am an anonymous user
    Then the primary navigation should list "Home"
    And the primary navigation should contain "About"
    And the primary navigation should list "Visit the apiary"
    And the primary navigation should not list "Dashboard"
    And the primary navigation should be open

  Scenario: A link of the primary navigation opens its page and becomes the current page
    Given I am an anonymous user
    Then the primary navigation should mark "Home" as the current page
    When I click "Visit the apiary" in the primary navigation
    Then the page heading should be "Visit the apiary"
    And the primary navigation should mark "Visit the apiary" as the current page
    And the primary navigation should not mark "Home" as the current page

  Scenario: On a narrow screen the primary navigation folds behind its toggle
    Given I am viewing the site on a "xs" device
    And I am on "/visit-the-apiary"
    Then the primary navigation should not be open
    When I toggle the primary navigation
    Then the primary navigation links should be open
    When I click "About" in the primary navigation
    Then the page heading should be "About"

  Scenario: The breadcrumb of a content page leads back to the home page
    Given I am on "/visit-the-apiary"
    Then the breadcrumb trail should be "Home"
    And the breadcrumb trail should not be "Home > Administration"

  Scenario: The breadcrumb of an administration page follows the administration menu
    Given I am logged in as "admin"
    And I am on the "menus" administration page
    Then the breadcrumb trail should be "Home > Administration > Structure"
    And the page heading should be "Menus"
    And the page heading should not be "Layouts"

  Scenario: Page tabs follow the permissions of the account
    Given I am on "/posts/field-note-12"
    Then I should not see the "Edit" page tab
    Given I am logged in as "editor"
    And I am on "/posts/field-note-12"
    Then I should see the "View" page tab
    And I should see the "Edit" page tab
    When I open the "Edit" page tab
    Then the page heading should be "Edit Post Field note 12"

  Scenario: Action links lead to the forms of a listing
    Given I am logged in as "editor"
    And I am on the "content" administration page
    When I follow the "Add content" action link
    Then the page heading should be "Add content"

  @critical
  Scenario: The pager of the home page listing walks through its pages
    Given I am on the homepage
    Then I should see a pager
    And the pager should be on page 1
    And I should see the teaser "Field note 12"
    And I should not see the teaser "Field note 02"
    When I go to the next page of the pager
    Then the pager should be on page 2
    And the pager should not be on page 1
    And I should see the teaser "Field note 02"
    When I go to the first page of the pager
    Then the pager should be on page 1
    When I go to the last page of the pager
    Then the pager should be on page 2
    When I go to the previous page of the pager
    Then the pager should be on page 1
    When I go to page 2 of the pager
    Then the pager should be on page 2

  Scenario: A page without a listing has no pager
    Given I am on "/visit-the-apiary"
    Then I should not see a pager
